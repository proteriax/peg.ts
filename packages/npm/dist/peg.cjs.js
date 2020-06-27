/**
 * PEG.js v0.11.0
 * https://pegjs.org/
 *
 * Copyright (c) 2010-2016 David Majda
 * Copyright (c) 2017+ Futago-za Ryuu
 * Copyright (c) 2020+ proteriax
 *
 * Released under the MIT License.
 */

/* eslint-disable */

"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

function _interopDefault(ex) {
  return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex
}

var lodash = require("lodash")
var jsesc = _interopDefault(require("jsesc"))

function calcReportFailures(ast, session, options) {
  ast.rules.forEach(rule => {
    rule.reportFailures = false
  })
  const changedRules = options.allowedStartRules.map(name => {
    const rule = ast.findRule(name)
    rule.reportFailures = true
    return rule
  })
  const calc = session.buildVisitor({
    rule(node) {
      calc(node.expression)
    },

    named() {},

    rule_ref(node) {
      const rule = ast.findRule(node.name)

      if (!rule.reportFailures) {
        rule.reportFailures = true
        changedRules.push(rule)
      }
    },
  })

  while (changedRules.length > 0) {
    calc(changedRules.pop())
  }
}

function generateBytecode(ast, session) {
  const op = session.opcodes
  const literals = []
  const classes = []
  const expectations = []
  const functions = []

  function addLiteralConst(value) {
    const index = literals.indexOf(value)
    return index === -1 ? literals.push(value) - 1 : index
  }

  function addClassConst(node) {
    const cls = {
      value: node.parts,
      inverted: node.inverted,
      ignoreCase: node.ignoreCase,
    }
    const pattern = JSON.stringify(cls)
    const index = classes.findIndex(c => JSON.stringify(c) === pattern)
    return index === -1 ? classes.push(cls) - 1 : index
  }

  function addExpectedConst(expected) {
    const pattern = JSON.stringify(expected)
    const index = expectations.findIndex(e => JSON.stringify(e) === pattern)
    return index === -1 ? expectations.push(expected) - 1 : index
  }

  function addFunctionConst(predicate, params, code) {
    const func = {
      predicate,
      params,
      body: code,
    }
    const pattern = JSON.stringify(func)
    const index = functions.findIndex(f => JSON.stringify(f) === pattern)
    return index === -1 ? functions.push(func) - 1 : index
  }

  const buildSequence = (...parts) => [].concat(...parts)

  function buildCondition(match, condCode, thenCode, elseCode) {
    if (match > 0) return thenCode
    if (match < 0) return elseCode
    return condCode.concat([thenCode.length, elseCode.length], thenCode, elseCode)
  }

  function buildLoop(condCode, bodyCode) {
    return condCode.concat([bodyCode.length], bodyCode)
  }

  function buildCall(functionIndex, delta, env, sp) {
    const params = lodash.map(env, value => sp - value)
    return [op.CALL, functionIndex, delta, params.length].concat(params)
  }

  function buildSimplePredicate(expression, negative, context) {
    const match = expression.match | 0
    return buildSequence(
      [op.PUSH_CURR_POS],
      [op.EXPECT_NS_BEGIN],
      generate(expression, {
        sp: context.sp + 1,
        env: { ...context.env },
        action: null,
        reportFailures: context.reportFailures,
      }),
      [op.EXPECT_NS_END, negative ? 1 : 0],
      buildCondition(
        negative ? -match : match,
        [negative ? op.IF_ERROR : op.IF_NOT_ERROR],
        buildSequence(
          [op.POP],
          [negative ? op.POP : op.POP_CURR_POS],
          [op.PUSH_UNDEFINED]
        ),
        buildSequence([op.POP], [negative ? op.POP_CURR_POS : op.POP], [op.PUSH_FAILED])
      )
    )
  }

  function buildSemanticPredicate(node, negative, context) {
    const functionIndex = addFunctionConst(true, Object.keys(context.env), node.code)
    return buildSequence(
      [op.UPDATE_SAVED_POS],
      buildCall(functionIndex, 0, context.env, context.sp),
      buildCondition(
        node.match | 0,
        [op.IF],
        buildSequence([op.POP], negative ? [op.PUSH_FAILED] : [op.PUSH_UNDEFINED]),
        buildSequence([op.POP], negative ? [op.PUSH_UNDEFINED] : [op.PUSH_FAILED])
      )
    )
  }

  function buildAppendLoop(expressionCode) {
    return buildLoop([op.WHILE_NOT_ERROR], buildSequence([op.APPEND], expressionCode))
  }

  const generate = session.buildVisitor({
    grammar(node) {
      node.rules.forEach(generate)
      node.literals = literals
      node.classes = classes
      node.expectations = expectations
      node.functions = functions
    },

    rule(node) {
      node.bytecode = generate(node.expression, {
        sp: -1,
        env: {},
        action: null,
        reportFailures: node.reportFailures,
      })
    },

    named(node, context) {
      const nameIndex = context.reportFailures
        ? addExpectedConst({
            type: "rule",
            value: node.name,
          })
        : null
      const expressionCode = generate(node.expression, {
        sp: context.sp,
        env: context.env,
        action: context.action,
        reportFailures: false,
      })
      return context.reportFailures
        ? buildSequence([op.EXPECT, nameIndex], [op.SILENT_FAILS_ON], expressionCode, [
            op.SILENT_FAILS_OFF,
          ])
        : expressionCode
    },

    choice(node, context) {
      function buildAlternativesCode(alternatives, context) {
        return buildSequence(
          generate(alternatives[0], {
            sp: context.sp,
            env: { ...context.env },
            action: null,
            reportFailures: context.reportFailures,
          }),
          alternatives.length < 2
            ? []
            : buildCondition(
                -(alternatives[0].match | 0),
                [op.IF_ERROR],
                buildSequence(
                  [op.POP],
                  buildAlternativesCode(alternatives.slice(1), context)
                ),
                []
              )
        )
      }

      return buildAlternativesCode(node.alternatives, context)
    },

    action(node, context) {
      const env = { ...context.env }
      const emitCall =
        node.expression.type !== "sequence" || node.expression.elements.length === 0
      const expressionCode = generate(node.expression, {
        sp: context.sp + (emitCall ? 1 : 0),
        env,
        action: node,
        reportFailures: context.reportFailures,
      })
      const match = node.expression.match | 0
      const functionIndex =
        emitCall && match >= 0
          ? addFunctionConst(false, Object.keys(env), node.code)
          : null
      return emitCall === false
        ? expressionCode
        : buildSequence(
            [op.PUSH_CURR_POS],
            expressionCode,
            buildCondition(
              match,
              [op.IF_NOT_ERROR],
              buildSequence(
                [op.LOAD_SAVED_POS, 1],
                buildCall(functionIndex, 1, env, context.sp + 2)
              ),
              []
            ),
            [op.NIP]
          )
    },

    sequence(node, context) {
      const TOTAL_ELEMENTS = node.elements.length

      function buildElementsCode(elements, context) {
        if (elements.length > 0) {
          const processedCount = TOTAL_ELEMENTS - elements.slice(1).length
          return buildSequence(
            generate(elements[0], {
              sp: context.sp,
              env: context.env,
              pluck: context.pluck,
              action: null,
              reportFailures: context.reportFailures,
            }),
            buildCondition(
              elements[0].match | 0,
              [op.IF_NOT_ERROR],
              buildElementsCode(elements.slice(1), {
                sp: context.sp + 1,
                env: context.env,
                pluck: context.pluck,
                action: context.action,
                reportFailures: context.reportFailures,
              }),
              buildSequence(
                processedCount > 1 ? [op.POP_N, processedCount] : [op.POP],
                [op.POP_CURR_POS],
                [op.PUSH_FAILED]
              )
            )
          )
        }

        if (context.pluck.length > 0)
          return buildSequence(
            [op.PLUCK, TOTAL_ELEMENTS + 1, context.pluck.length],
            context.pluck.map(eSP => context.sp - eSP)
          )
        if (context.action)
          return buildSequence(
            [op.LOAD_SAVED_POS, TOTAL_ELEMENTS],
            buildCall(
              addFunctionConst(false, Object.keys(context.env), context.action.code),
              TOTAL_ELEMENTS + 1,
              context.env,
              context.sp
            )
          )
        return buildSequence([op.WRAP, TOTAL_ELEMENTS], [op.NIP])
      }

      return buildSequence(
        [op.PUSH_CURR_POS],
        buildElementsCode(node.elements, {
          sp: context.sp + 1,
          env: context.env,
          pluck: [],
          action: context.action,
          reportFailures: context.reportFailures,
        })
      )
    },

    labeled(node, context) {
      let env = context.env
      const label = node.label
      const sp = context.sp + 1

      if (label !== null) {
        env = { ...context.env }
        context.env[label] = sp
      }

      if (context.pluck && node.pick) context.pluck.push(sp)
      return generate(node.expression, {
        sp: context.sp,
        env,
        action: null,
        reportFailures: context.reportFailures,
      })
    },

    text(node, context) {
      return buildSequence(
        [op.PUSH_CURR_POS],
        generate(node.expression, {
          sp: context.sp + 1,
          env: { ...context.env },
          action: null,
          reportFailures: context.reportFailures,
        }),
        buildCondition(
          node.expression.match | 0,
          [op.IF_NOT_ERROR],
          buildSequence([op.POP], [op.TEXT]),
          [op.NIP]
        )
      )
    },

    simple_and(node, context) {
      return buildSimplePredicate(node.expression, false, context)
    },

    simple_not(node, context) {
      return buildSimplePredicate(node.expression, true, context)
    },

    optional(node, context) {
      return buildSequence(
        generate(node.expression, {
          sp: context.sp,
          env: { ...context.env },
          action: null,
          reportFailures: context.reportFailures,
        }),
        buildCondition(
          -(node.expression.match | 0),
          [op.IF_ERROR],
          buildSequence([op.POP], [op.PUSH_NULL]),
          []
        )
      )
    },

    zero_or_more(node, context) {
      const expressionCode = generate(node.expression, {
        sp: context.sp + 1,
        env: { ...context.env },
        action: null,
        reportFailures: context.reportFailures,
      })
      return buildSequence(
        [op.PUSH_EMPTY_ARRAY],
        expressionCode,
        buildAppendLoop(expressionCode),
        [op.POP]
      )
    },

    one_or_more(node, context) {
      const expressionCode = generate(node.expression, {
        sp: context.sp + 1,
        env: { ...context.env },
        action: null,
        reportFailures: context.reportFailures,
      })
      return buildSequence(
        [op.PUSH_EMPTY_ARRAY],
        expressionCode,
        buildCondition(
          node.expression.match | 0,
          [op.IF_NOT_ERROR],
          buildSequence(buildAppendLoop(expressionCode), [op.POP]),
          buildSequence([op.POP], [op.POP], [op.PUSH_FAILED])
        )
      )
    },

    group(node, context) {
      return generate(node.expression, {
        sp: context.sp,
        env: { ...context.env },
        action: null,
        reportFailures: context.reportFailures,
      })
    },

    semantic_and(node, context) {
      return buildSemanticPredicate(node, false, context)
    },

    semantic_not(node, context) {
      return buildSemanticPredicate(node, true, context)
    },

    rule_ref(node) {
      return [op.RULE, ast.indexOfRule(node.name)]
    },

    literal(node, context) {
      if (node.value.length > 0) {
        const match = node.match | 0
        const needConst = match === 0 || (match > 0 && !node.ignoreCase)
        const stringIndex = needConst
          ? addLiteralConst(node.ignoreCase ? node.value.toLowerCase() : node.value)
          : null
        const expectedIndex = context.reportFailures
          ? addExpectedConst({
              type: "literal",
              value: node.value,
              ignoreCase: node.ignoreCase,
            })
          : null
        return buildSequence(
          context.reportFailures ? [op.EXPECT, expectedIndex] : [],
          buildCondition(
            match,
            node.ignoreCase
              ? [op.MATCH_STRING_IC, stringIndex]
              : [op.MATCH_STRING, stringIndex],
            node.ignoreCase
              ? [op.ACCEPT_N, node.value.length]
              : [op.ACCEPT_STRING, stringIndex],
            [op.PUSH_FAILED]
          )
        )
      }

      return [op.PUSH_EMPTY_STRING]
    },

    class(node, context) {
      const match = node.match | 0
      const classIndex = match === 0 ? addClassConst(node) : null
      const expectedIndex = context.reportFailures
        ? addExpectedConst({
            type: "class",
            value: node.parts,
            inverted: node.inverted,
            ignoreCase: node.ignoreCase,
          })
        : null
      return buildSequence(
        context.reportFailures ? [op.EXPECT, expectedIndex] : [],
        buildCondition(
          match,
          [op.MATCH_CLASS, classIndex],
          [op.ACCEPT_N, 1],
          [op.PUSH_FAILED]
        )
      )
    },

    any(node, context) {
      const expectedIndex = context.reportFailures
        ? addExpectedConst({
            type: "any",
          })
        : null
      return buildSequence(
        context.reportFailures ? [op.EXPECT, expectedIndex] : [],
        buildCondition(node.match | 0, [op.MATCH_ANY], [op.ACCEPT_N, 1], [op.PUSH_FAILED])
      )
    },
  })
  generate(ast)
}

function hex(ch) {
  return ch.charCodeAt(0).toString(16).toUpperCase()
}

function sourceEscape(s) {
  return s
    .replace(/\0/g, "\\0")
    .replace(/\x08/g, "\\b")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\v/g, "\\v")
    .replace(/\f/g, "\\f")
    .replace(/\r/g, "\\r")
    .replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch))
    .replace(/[\x10-\x1F\x7F-\xFF]/g, ch => "\\x" + hex(ch))
    .replace(/[\u0100-\u0FFF]/g, ch => "\\u0" + hex(ch))
    .replace(/[\u1000-\uFFFF]/g, ch => "\\u" + hex(ch))
}

function regexpEscape(s) {
  return sourceEscape(
    s
      .replace(/\\/g, "\\\\")
      .replace(/\//g, "\\/")
      .replace(/]/g, "\\]")
      .replace(/\^/g, "\\^")
      .replace(/-/g, "\\-")
  )
}
const reservedWords = [
  "break",
  "case",
  "catch",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "finally",
  "for",
  "function",
  "if",
  "in",
  "instanceof",
  "new",
  "return",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "class",
  "const",
  "enum",
  "export",
  "extends",
  "implements",
  "import",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "super",
  "yield",
  "false",
  "null",
  "true",
]

function evalModule(source, context = {}) {
  const argumentKeys = Object.keys(context)
  const argumentValues = Object.values(context)
  const module = {
    exports: {},
  }
  argumentKeys.push(
    "module",
    "exports",
    "require",
    `
    try {
      ${source}
    } catch (e) {
      console.trace();
      console.error(e);
      throw e;
    }`
  )
  argumentValues.push(module, module.exports, require)
  Function(...argumentKeys)(...argumentValues)
  return module.exports
}

function convertPasses(stages) {
  return lodash.mapValues(stages, passes =>
    Array.isArray(passes) ? passes : Object.values(passes)
  )
}

var mod = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  convertPasses: convertPasses,
  regexpEscape: regexpEscape,
  reservedWords: reservedWords,
  evalModule: evalModule,
})

var name = "@pegjs/main"
var version = "0.11.0"

class peg$SyntaxError extends Error {
  constructor(message, expected, found, location) {
    var _Error$captureStackTr

    super(message)
    this.expected = expected
    this.found = found
    this.location = location
    this.expected = expected
    this.name = "PEG.SyntaxError"
    ;(_Error$captureStackTr = Error.captureStackTrace) === null ||
    _Error$captureStackTr === void 0
      ? void 0
      : _Error$captureStackTr.call(Error, this, peg$SyntaxError)
  }

  static buildMessage(expected, found) {
    const DESCRIBE_EXPECTATION_FNS = {
      literal: ({ text }) => `"${literalEscape(text)}"`,
      class: ({ inverted, parts }) =>
        "[" +
        (inverted ? "^" : "") +
        parts
          .map(part =>
            Array.isArray(part)
              ? `${classEscape(part[0])}-${classEscape(part[1])}`
              : classEscape(part)
          )
          .join("") +
        "]",
      any: () => "any character",
      end: () => "end of input",
      other: ({ description }) => description,
      not: ({ expected }) => describeExpectation(expected),
    }

    function hex(ch) {
      return ch.charCodeAt(0).toString(16).toUpperCase()
    }

    function literalEscape(s) {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\0/g, "\\0")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch))
        .replace(/[\x10-\x1F\x7F-\x9F]/g, ch => "\\x" + hex(ch))
    }

    function classEscape(s) {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/\]/g, "\\]")
        .replace(/\^/g, "\\^")
        .replace(/-/g, "\\-")
        .replace(/\0/g, "\\0")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch))
        .replace(/[\x10-\x1F\x7F-\x9F]/g, ch => "\\x" + hex(ch))
    }

    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation)
    }

    return `Expected ${(function (expected) {
      const descriptions = expected.map(describeExpectation).sort()

      if (descriptions.length > 0) {
        let j = 1

        for (let i = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i]
            j++
          }
        }

        descriptions.length = j
      }

      switch (descriptions.length) {
        case 1:
          return descriptions[0]

        case 2:
          return `${descriptions[0]} or ${descriptions[1]}`

        default:
          return (
            descriptions.slice(0, -1).join(", ") +
            ", or " +
            descriptions[descriptions.length - 1]
          )
      }
    })(expected)} but ${(function (found) {
      return found ? `"${literalEscape(found)}"` : "end of input"
    })(found)} found.`
  }
}
function peg$buildSimpleError(message, location) {
  return new peg$SyntaxError(message, null, null, location)
}
function peg$buildStructuredError(expected, found, location) {
  return new peg$SyntaxError(
    peg$SyntaxError.buildMessage(expected, found, location),
    expected,
    found,
    location
  )
}

var id = 0

function _classPrivateFieldLooseKey(name) {
  return "__private_" + id++ + "_" + name
}

function _classPrivateFieldLooseBase(receiver, privateKey) {
  if (!Object.prototype.hasOwnProperty.call(receiver, privateKey)) {
    throw new TypeError("attempted to use private field on non-instance")
  }

  return receiver
}

var _indentLevel = _classPrivateFieldLooseKey("indentLevel")

class peg$DefaultTracer {
  constructor() {
    Object.defineProperty(this, _indentLevel, {
      writable: true,
      value: 0,
    })
  }

  trace(event) {
    const log = () => {
      var _console

      const { location, type, rule } = event
      const { start, end } = location
      ;(_console = console) === null || _console === void 0
        ? void 0
        : _console.log(
            `${start.line}:${start.column}-${end.line}:${end.column} ` +
              type.padEnd(10) +
              " ".repeat(
                _classPrivateFieldLooseBase(this, _indentLevel)[_indentLevel] * 2 + 1
              ) +
              rule
          )
    }

    switch (event.type) {
      case "rule.enter":
        log()
        _classPrivateFieldLooseBase(this, _indentLevel)[_indentLevel]++
        break

      case "rule.match":
        _classPrivateFieldLooseBase(this, _indentLevel)[_indentLevel]--
        log()
        break

      case "rule.fail":
        _classPrivateFieldLooseBase(this, _indentLevel)[_indentLevel]--
        log()
        break

      default:
        throw new Error(`Invalid event type: ${event.type}.`)
    }
  }
}

function peg$literalExpectation(text, ignoreCase) {
  return {
    type: "literal",
    text,
    ignoreCase,
  }
}
function peg$classExpectation(parts, inverted, ignoreCase) {
  return {
    type: "class",
    parts,
    inverted,
    ignoreCase,
  }
}
function peg$anyExpectation() {
  return {
    type: "any",
  }
}
function peg$endExpectation() {
  return {
    type: "end",
  }
}
function peg$otherExpectation(description) {
  return {
    type: "other",
    description,
  }
}

function assertString(value) {
  return value
}

function join(generator) {
  return Array.from(generator, s => assertString(s || "")).join("\n")
}

const l = i => `peg$c${i}`

const r = i => `peg$r${i}`

const e = i => `peg$e${i}`

const f = i => `peg$f${i}`

function buildLiteral(literal) {
  return "'" + jsesc(literal) + "'"
}

function generateJS(ast, session, options) {
  const op = session.opcodes
  const features = options.features || {}

  function use(feature) {
    return feature in features ? !!features[feature] : true
  }

  function* generateTables() {
    function buildRegexp(cls) {
      return (
        "/^[" +
        (cls.inverted ? "^" : "") +
        cls.value
          .map(part =>
            Array.isArray(part)
              ? `${regexpEscape(part[0])}-${regexpEscape(part[1])}`
              : regexpEscape(part)
          )
          .join("") +
        "]/" +
        (cls.ignoreCase ? "i" : "")
      )
    }

    function buildExpectation(e) {
      switch (e.type) {
        case "rule":
          return `peg$otherExpectation(${buildLiteral(e.value)})`

        case "literal":
          return `peg$literalExpectation(${buildLiteral(e.value)}, ${e.ignoreCase})`

        case "class": {
          const parts = e.value.map(part =>
            Array.isArray(part)
              ? `[${buildLiteral(part[0])}, ${buildLiteral(part[1])}]`
              : `${buildLiteral(part)}`
          )
          return `peg$classExpectation([${parts.join(", ")}], ${e.inverted}, ${
            e.ignoreCase
          })`
        }

        case "any":
          return "peg$anyExpectation()"

        default:
          session.fatal(`Unknown expectation type (${JSON.stringify(e)})`)
      }
    }

    function buildFunc(f) {
      if (/^\s+return /.test(f.body)) {
        return (
          "(" +
          f.params.join(", ") +
          ") => " +
          f.body
            .trim()
            .replace(/^return /, "")
            .replace(/;$/, "")
        )
      }

      return `function(${f.params.join(", ")}) {${f.body}}`
    }

    if (options.optimize === "size") {
      yield `
        const peg$literals = [
          ${ast.literals.map(buildLiteral).join(",")}
        ]
        const peg$regexps = [
          ${ast.classes.map(buildRegexp).join(",")}
        ]
        const peg$expectations = [
          ${ast.expectations.map(buildExpectation).join(",")}
        ]
        const peg$functions = [
          ${ast.functions.map(buildFunc).join(",")}
        ]
        
        const peg$bytecode = [
          ${ast.rules
            .map(rule => rule.bytecode)
            .map(bytecode => bytecode.map(b => String.fromCharCode(b + 32)).join(""))
            .map(decode => `peg$decode(${JSON.stringify(decode)})`)
            .join(",")}
        ]
      `
    }

    yield* ast.literals.map((c, i) => `const ${l(i)} = ${buildLiteral(c)}`)
    yield
    yield* ast.classes.map((c, i) => `const ${r(i)} = ${buildRegexp(c)}`)
    yield
    yield* ast.expectations.map((c, i) => `const ${e(i)} = ${buildExpectation(c)}`)
    yield
    yield* ast.functions.map((c, i) => `const ${f(i)} = ${buildFunc(c)}`)
    yield
  }

  function* generateRuleHeader(ruleNameCode, ruleIndexCode) {
    yield `
      
      let rule$expects = (expected) =>{
        if (peg$silentFails === 0) {
          peg$expect(expected);
        }
      };
      
    `

    if (options.trace) {
      yield `
        peg$tracer && peg$tracer.trace({
          type: "rule.enter",
          rule: ${ruleNameCode},
          location: peg$computeLocation(startPos, startPos)
        });

      `
    }

    if (options.cache) {
      yield `
        let key = peg$currPos * ${ast.rules.length} + ${ruleIndexCode};
        let cached = peg$resultsCache.get(key);
        let rule$expectations = [];
        
        rule$expects = (expected) => {
          if (peg$silentFails === 0) peg$expect(expected);
          rule$expectations.push(expected);
        }
        
        if (cached) {
          peg$currPos = cached.nextPos;
        
          rule$expectations = cached.expectations;
          if (peg$silentFails === 0) {
            rule$expectations.forEach(peg$expect);
          }

          return cached.result;
        
      `

      if (options.trace) {
        yield `
          if (cached.result !== peg$FAILED) {
            peg$tracer && peg$tracer.trace({
              type: "rule.match",
              rule: ${ruleNameCode},
              result: cached.result,
              location: peg$computeLocation(startPos, peg$currPos)
            });
          } else {
            peg$tracer && peg$tracer.trace({
              type: "rule.fail",
              rule: ${ruleNameCode},
              location: peg$computeLocation(startPos, startPos)
            });
          }
          
          return cached.result;
      `
      }

      yield "}"
    }
  }

  function* generateRuleFooter(ruleNameCode, resultCode) {
    if (options.cache) {
      yield `
          
          peg$resultsCache.set(key, {
            nextPos: peg$currPos,
            result: ${resultCode},
            expectations: rule$expectations
          });
        `
    }

    if (options.trace) {
      yield `
          
          if (${resultCode} !== peg$FAILED) {
            peg$tracer && peg$tracer.trace({
              type: "rule.match",
              rule: ${ruleNameCode},
              result: ${resultCode},
              location: peg$computeLocation(startPos, peg$currPos)
            });
          } else {
            peg$tracer && peg$tracer.trace({
              type: "rule.fail",
              rule: ${ruleNameCode},
              location: peg$computeLocation(startPos, startPos)
            });
          }
        `
    }

    yield
    yield `return ${resultCode};`
  }

  function* generateInterpreter() {
    function generateCondition(condition, argsLength) {
      const baseLength = argsLength + 3
      const thenLengthCode = `bc[ip + ${baseLength - 2}]`
      const elseLengthCode = `bc[ip + ${baseLength - 1}]`
      return `
        ends.push(end);
        ips.push(ip + ${baseLength} + ${thenLengthCode} + ${elseLengthCode});
        
        if (${condition}) {
          end = ip + ${baseLength} + ${thenLengthCode};
          ip += ${baseLength};
        } else {
          end = ip + ${baseLength} + ${thenLengthCode} + ${elseLengthCode};
          ip += ${baseLength} + ${thenLengthCode};
        }
        
        break;
      `
    }

    yield `
      function peg$decode(s) {
        return s.split("").map(ch => ch.charCodeAt(0) - 32);
      }
      
      function peg$parseRule(index) {
    `

    if (options.trace) {
      yield `
          let bc = peg$bytecode[index];
          let ip = 0;
          let ips = [];
          let end = bc.length;
          let ends = [];
          let stack = [];
          let startPos = peg$currPos;
          let params, paramsLength, paramsN;
      `
    } else {
      yield `
          let bc = peg$bytecode[index];
          let ip = 0;
          let ips = [];
          let end = bc.length;
          let ends = [];
          let stack = [];
          let params, paramsLength, paramsN;
      `
    }

    yield* generateRuleHeader("peg$ruleNames[index]", "index")
    yield `
      while (true) {
        while (ip < end) {
          switch (bc[ip]) {
            case ${op.PUSH_EMPTY_STRING}: // PUSH_EMPTY_STRING
              stack.push('');
              ip++;
              break;
    
            case ${op.PUSH_UNDEFINED}: // PUSH_UNDEFINED
              stack.push(undefined);
              ip++;
              break;
    
            case ${op.PUSH_NULL}: // PUSH_NULL
              stack.push(null);
              ip++;
              break;
    
            case ${op.PUSH_FAILED}: // PUSH_FAILED
              stack.push(peg$FAILED);
              ip++;
              break;
    
            case ${op.PUSH_EMPTY_ARRAY}: // PUSH_EMPTY_ARRAY
              stack.push([]);
              ip++;
              break;
    
            case ${op.PUSH_CURR_POS}: // PUSH_CURR_POS
              stack.push(peg$currPos);
              ip++;
              break;
    
            case ${op.POP}: // POP
              stack.pop();
              ip++;
              break;
      
            case ${op.POP_CURR_POS}: // POP_CURR_POS
              peg$currPos = stack.pop();
              ip++;
              break;
    
            case ${op.POP_N}: // POP_N n
              stack.length -= bc[ip + 1];
              ip += 2;
              break;
    
            case ${op.NIP}: // NIP
              stack.splice(-2, 1);
              ip++;
              break;
    
            case ${op.APPEND}: // APPEND
              stack[stack.length - 2].push(stack.pop());
              ip++;
              break;
    
            case ${op.WRAP}: // WRAP n
              stack.push(stack.splice(stack.length - bc[ip + 1], bc[ip + 1]));
              ip += 2;
              break;
    
            case ${op.TEXT}: // TEXT
              stack.push(input.substring(stack.pop(), peg$currPos));
              ip++;
              break;
    
            case ${op.PLUCK}: // PLUCK n, k, p1, ..., pK
                paramsLength = bc[ip + 2];
                paramsN = 3 + paramsLength
      
                params = bc.slice(ip + 3, ip + paramsN);
                params = paramsLength === 1
                  ? stack[stack.length - 1 - params[ 0 ]]
                  : params.map(function(p) { return stack[stack.length - 1 - p]; });
      
                stack.splice(
                  stack.length - bc[ip + 1],
                  bc[ip + 1],
                  params
                );
      
                ip += paramsN;
                break;
      
              case ${op.IF}: // IF t, f
                ${generateCondition("stack[stack.length - 1]", 0)}
      
              case ${op.IF_ERROR}: // IF_ERROR t, f
                ${generateCondition("stack[stack.length - 1] === peg$FAILED", 0)}
      
              case ${op.IF_NOT_ERROR}: // IF_NOT_ERROR t, f
                ${generateCondition("stack[stack.length - 1] !== peg$FAILED", 0)}
      
              case ${op.WHILE_NOT_ERROR}: // WHILE_NOT_ERROR b
                ${(function (condition) {
                  const baseLength = 2
                  const bodyLengthCode = `bc[ip + ${baseLength - 1}]`
                  return `
        if (${condition}) {
          ends.push(end);
          ips.push(ip);
        
          end = ip + ${baseLength} + ${bodyLengthCode};
          ip += ${baseLength};
        } else {
          ip += ${baseLength} + ${bodyLengthCode};
        }
        
        break;
      `
                })("stack[stack.length - 1] !== peg$FAILED")}
      
              case ${op.MATCH_ANY}: // MATCH_ANY a, f, ...
                ${generateCondition("input.length > peg$currPos", 0)}
      
              case ${op.MATCH_STRING}: // MATCH_STRING s, a, f, ...
                ${generateCondition(
                  "input.substr(peg$currPos, peg$literals[bc[ip + 1]].length) === peg$literals[bc[ip + 1]]",
                  1
                )}
      
              case ${op.MATCH_STRING_IC}: // MATCH_STRING_IC s, a, f, ...
                ${generateCondition(
                  "input.substr(peg$currPos, peg$literals[bc[ip + 1]].length).toLowerCase() === peg$literals[bc[ip + 1]]",
                  1
                )}
      
              case ${op.MATCH_CLASS}: // MATCH_CLASS c, a, f, ...
                ${generateCondition(
                  "peg$regexps[bc[ip + 1]].test(input.charAt(peg$currPos))",
                  1
                )}
      
              case ${op.ACCEPT_N}: // ACCEPT_N n
                stack.push(input.substr(peg$currPos, bc[ip + 1]));
                peg$currPos += bc[ip + 1];
                ip += 2;
                break;
      
              case ${op.ACCEPT_STRING}: // ACCEPT_STRING s
                stack.push(peg$literals[bc[ip + 1]]);
                peg$currPos += peg$literals[bc[ip + 1]].length;
                ip += 2;
                break;
      
              case ${op.EXPECT}: // EXPECT e
                rule$expects(peg$expectations[bc[ip + 1]]);
                ip += 2;
                break;
      
              case ${op.LOAD_SAVED_POS}: // LOAD_SAVED_POS p
                peg$savedPos = stack[stack.length - 1 - bc[ip + 1]];
                ip += 2;
                break;
      
              case ${op.UPDATE_SAVED_POS}: // UPDATE_SAVED_POS
                peg$savedPos = peg$currPos;
                ip++;
                break;
      
              case ${op.CALL}: // CALL f, n, pc, p1, p2, ..., pN
                ${(function () {
                  const baseLength = 4
                  const paramsLengthCode = `bc[ip + ${baseLength - 1}]`
                  return `
        params = bc.slice(ip + ${baseLength}, ip + ${baseLength} + ${paramsLengthCode})
          .map(p => stack[stack.length - 1 - p]);
        
        stack.splice(
          stack.length - bc[ip + 2],
          bc[ip + 2],
          peg$functions[bc[ip + 1]].apply(null, params)
        );
        
        ip += ${baseLength} + ${paramsLengthCode};
        break;
      `
                })()}
      
              case ${op.RULE}: // RULE r
                stack.push(peg$parseRule(bc[ip + 1]));
                ip += 2;
                break;
      
              case ${op.SILENT_FAILS_ON}: // SILENT_FAILS_ON
                peg$silentFails++;
                ip++;
                break;
      
              case ${op.SILENT_FAILS_OFF}: // SILENT_FAILS_OFF
                peg$silentFails--;
                ip++;
                break;
      
              case ${op.EXPECT_NS_BEGIN}: // EXPECT_NS_BEGIN
                peg$begin();
                ip++;
                break;
      
              case ${op.EXPECT_NS_END}: // EXPECT_NS_END invert
                peg$end(bc[ip + 1]);
                ip += 2;
                break;
      
              // istanbul ignore next
              default:
                throw new Error(
                  "Rule #" + index + "${
                    options.trace ? " ('\" + peg$ruleNames[ index ] + \"')" : ""
                  }, position " + ip + ": "
                  + "Invalid opcode " + bc[ip] + "."
                );
            }
          }
      
          if (ends.length > 0) {
            end = ends.pop();
            ip = ips.pop();
          } else {
            break;
          }
        }
    `
    yield* generateRuleFooter("peg$ruleNames[index]", "stack[0]")
    yield "}"
  }

  function* generateRuleFunction(rule) {
    const stackVars = []

    function s(i) {
      if (i < 0) {
        session.fatal(
          `Rule '${rule.name}': Var stack underflow: attempt to use var at index ${i}`
        )
      }

      return `s${i}`
    }

    const stack = {
      sp: -1,
      maxSp: -1,

      push(exprCode) {
        const code = `${s(++this.sp)} = ${exprCode};`
        if (this.sp > this.maxSp) this.maxSp = this.sp
        return code
      },

      pop() {
        return s(this.sp--)
      },

      pop2(n) {
        const values = Array(n)

        for (let i = 0; i < n; i++) {
          values[i] = s(this.sp - n + 1 + i)
        }

        this.sp -= n
        return values
      },

      top() {
        return s(this.sp)
      },

      index(i) {
        return s(this.sp - i)
      },
    }

    function* compile(bc) {
      let ip = 0
      const end = bc.length

      function* compileCondition(condition, argCount) {
        const pos = ip
        const baseLength = argCount + 3
        const thenLength = bc[ip + baseLength - 2]
        const elseLength = bc[ip + baseLength - 1]
        const baseSp = stack.sp
        yield `if (${condition}) {`
        ip += baseLength
        yield* compile(bc.slice(ip, ip + thenLength))
        const thenSp = stack.sp
        ip += thenLength

        if (elseLength > 0) {
          stack.sp = baseSp
          yield "} else {"
          yield* compile(bc.slice(ip, ip + elseLength))
          const elseSp = stack.sp
          ip += elseLength

          if (thenSp !== elseSp) {
            session.fatal(
              `Rule '${rule.name}', position ${pos}: Branches of a condition can't move the stack pointer differently (before: ${baseSp}, after then: ${thenSp}, after else: ${elseSp}).`
            )
          }
        }

        yield "}"
      }

      function* compileLoop(condition) {
        const pos = ip
        const baseLength = 2
        const bodyLength = bc[ip + baseLength - 1]
        const baseSp = stack.sp
        yield `while (${condition}) {`
        ip += baseLength
        yield* compile(bc.slice(ip, ip + bodyLength))
        const bodySp = stack.sp
        ip += bodyLength

        if (bodySp !== baseSp) {
          session.fatal(
            `Rule '${rule.name}', position ${pos}: Body of a loop can't move the stack pointer (before: ${baseSp}, after: ${bodySp}).`
          )
        }

        yield "}"
      }

      function* compileCall() {
        const baseLength = 4
        const paramsLength = bc[ip + baseLength - 1]
        const value = `${f(bc[ip + 1])}(${bc
          .slice(ip + baseLength, ip + baseLength + paramsLength)
          .map(p => stack.index(p))
          .join(", ")})`
        stack.pop2(bc[ip + 2])
        yield stack.push(value)
        ip += baseLength + paramsLength
      }

      const nextByteCode = () => bc[ip + 1]

      while (ip < end) {
        let value

        switch (bc[ip]) {
          case op.PUSH_EMPTY_STRING:
            yield stack.push("''")
            ip++
            break

          case op.PUSH_CURR_POS:
            yield stack.push("peg$currPos")
            ip++
            break

          case op.PUSH_UNDEFINED:
            yield stack.push("undefined")
            ip++
            break

          case op.PUSH_NULL:
            yield stack.push("null")
            ip++
            break

          case op.PUSH_FAILED:
            yield stack.push("peg$FAILED")
            ip++
            break

          case op.PUSH_EMPTY_ARRAY:
            yield stack.push("[]")
            ip++
            break

          case op.POP:
            stack.pop()
            ip++
            break

          case op.POP_CURR_POS:
            yield `peg$currPos = ${stack.pop()};`
            ip++
            break

          case op.POP_N:
            stack.pop2(nextByteCode())
            ip += 2
            break

          case op.NIP:
            value = stack.pop()
            stack.pop()
            yield stack.push(value)
            ip++
            break

          case op.APPEND:
            value = stack.pop()
            yield `${stack.top()}.push(${value});`
            ip++
            break

          case op.WRAP:
            yield stack.push(`[${stack.pop2(nextByteCode()).join(", ")}]`)
            ip += 2
            break

          case op.TEXT:
            yield stack.push(`input.substring(${stack.pop()}, peg$currPos)`)
            ip++
            break

          case op.PLUCK: {
            const baseLength = 3
            const paramsLength = bc[ip + baseLength - 1]
            const n = baseLength + paramsLength
            const value = bc.slice(ip + baseLength, ip + n)
            const value1 =
              paramsLength === 1
                ? stack.index(value[0])
                : `[ ${value.map(p => stack.index(p)).join(", ")} ]`
            stack.pop2(nextByteCode())
            yield stack.push(value1)
            ip += n
            break
          }

          case op.IF:
            yield* compileCondition(stack.top(), 0)
            break

          case op.IF_ERROR:
            yield* compileCondition(`${stack.top()} === peg$FAILED`, 0)
            break

          case op.IF_NOT_ERROR:
            yield* compileCondition(`${stack.top()} !== peg$FAILED`, 0)
            break

          case op.WHILE_NOT_ERROR:
            yield* compileLoop(`${stack.top()} !== peg$FAILED`)
            break

          case op.MATCH_ANY:
            yield* compileCondition("input.length > peg$currPos", 0)
            break

          case op.MATCH_STRING:
            yield* compileCondition(
              ast.literals[nextByteCode()].length > 1
                ? `input.substr(peg$currPos, ${
                    ast.literals[nextByteCode()].length
                  }) === ${l(nextByteCode())}`
                : `input.charCodeAt(peg$currPos) === ${ast.literals[
                    nextByteCode()
                  ].charCodeAt(0)}`,
              1
            )
            break

          case op.MATCH_STRING_IC:
            yield* compileCondition(
              `input.substr(peg$currPos, ${
                ast.literals[nextByteCode()].length
              }).toLowerCase() === ${l(nextByteCode())}`,
              1
            )
            break

          case op.MATCH_CLASS:
            yield* compileCondition(
              `${r(nextByteCode())}.test(input.charAt(peg$currPos))`,
              1
            )
            break

          case op.ACCEPT_N:
            yield stack.push(
              nextByteCode() > 1
                ? `input.substr(peg$currPos, ${nextByteCode()})`
                : "input.charAt(peg$currPos)"
            )
            yield nextByteCode() > 1
              ? `peg$currPos += ${nextByteCode()};`
              : "peg$currPos++;"
            ip += 2
            break

          case op.ACCEPT_STRING:
            yield stack.push(l(nextByteCode()))
            yield ast.literals[nextByteCode()].length > 1
              ? `peg$currPos += ${ast.literals[nextByteCode()].length};`
              : "peg$currPos++;"
            ip += 2
            break

          case op.EXPECT:
            yield `rule$expects(${e(nextByteCode())});`
            ip += 2
            break

          case op.LOAD_SAVED_POS:
            yield `peg$savedPos = ${stack.index(nextByteCode())};`
            ip += 2
            break

          case op.UPDATE_SAVED_POS:
            yield "peg$savedPos = peg$currPos;"
            ip++
            break

          case op.CALL:
            yield* compileCall()
            break

          case op.RULE:
            yield stack.push(`peg$parse${ast.rules[nextByteCode()].name}()`)
            ip += 2
            break

          case op.SILENT_FAILS_ON:
            yield "peg$silentFails++;"
            ip++
            break

          case op.SILENT_FAILS_OFF:
            yield "peg$silentFails--;"
            ip++
            break

          case op.EXPECT_NS_BEGIN:
            yield "peg$begin();"
            ip++
            break

          case op.EXPECT_NS_END:
            yield `peg$end(${nextByteCode() !== 0});`
            ip += 2
            break

          default:
            session.fatal(
              `Rule '${rule.name}', position ${ip}: Invalid opcode ${bc[ip]}.`
            )
        }
      }
    }

    const code = join(compile(rule.bytecode))
    yield `function peg$parse${rule.name}() {`

    if (options.trace) {
      yield "  let startPos = peg$currPos;"
    }

    for (let i = 0; i <= stack.maxSp; i++) {
      stackVars[i] = s(i)
    }

    yield `  let ${stackVars.join(", ")};`
    yield* generateRuleHeader(JSON.stringify(rule.name), ast.indexOfRule(rule.name))
    yield code
    yield* generateRuleFooter(JSON.stringify(rule.name), s(0))
    yield "}"
  }

  function generateWrapper(topLevelCode) {
    function* generateHeaderComment() {
      yield `// Generated by PEG.js v${version}, https://pegjs.org/`
      const header = options.header

      if (lodash.isString(header)) {
        yield `\n\n${header}`
      } else if (Array.isArray(header)) {
        yield "\n\n"

        for (const data of header) {
          yield `// ${data}`
        }
      }
    }

    function generateParserObject() {
      return options.trace && use("DefaultTracer")
        ? `{
            SyntaxError: peg$SyntaxError,
            DefaultTracer: peg$DefaultTracer,
            parse: peg$parse
          }`
        : `{
            SyntaxError: peg$SyntaxError,
            parse: peg$parse
          }`
    }

    function generateParserExports() {
      return options.trace && use("DefaultTracer")
        ? `{
            peg$SyntaxError as SyntaxError,
            peg$DefaultTracer as DefaultTracer,
            peg$parse as parse
          }`
        : `{
            peg$SyntaxError as SyntaxError,
            peg$parse as parse
          }`
    }

    function generateHelpers() {
      return `
        ${peg$SyntaxError}
        ${peg$buildSimpleError}
        ${peg$buildStructuredError}
        ${peg$literalExpectation}
        ${peg$DefaultTracer}
        ${peg$classExpectation}
        ${peg$anyExpectation}
        ${peg$endExpectation}
        ${peg$otherExpectation}
      `
    }

    const generators = {
      *commonjs() {
        yield* generateHeaderComment()

        if (options.helpers) {
          yield `const {
              peg$SyntaxError,
              peg$buildSimpleError,
              peg$buildStructuredError,
            } = require("${options.helpers}/SyntaxError");
            const { peg$DefaultTracer } = require("${options.helpers}/DefaultTracer");
            const {
              peg$literalExpectation,
              peg$classExpectation,
              peg$anyExpectation,
              peg$endExpectation,
              peg$otherExpectation,       
            } = require("${options.helpers}/expectation");
          `
        } else {
          yield generateHelpers()
        }

        yield
        yield '"use strict";'
        yield

        if (!lodash.isEmpty(options.dependencies)) {
          yield* lodash.map(
            options.dependencies,
            (value, variable) => `const ${variable} = require(${JSON.stringify(value)});`
          )
          yield
        }

        yield* topLevelCode
        yield
        yield `module.exports = ${generateParserObject()};`
        yield
      },

      *es() {
        yield* generateHeaderComment()

        if (options.helpers) {
          yield `import {
            peg$SyntaxError,
            peg$buildSimpleError,
            peg$buildStructuredError,
          } from "${options.helpers}/SyntaxError";
          import { peg$DefaultTracer } from "${options.helpers}/DefaultTracer";
          import {
            peg$literalExpectation,
            peg$classExpectation,
            peg$anyExpectation,
            peg$endExpectation,
            peg$otherExpectation,       
          } from "${options.helpers}/expectation";
        `
        } else {
          yield generateHelpers()
        }

        yield

        if (!lodash.isEmpty(options.dependencies)) {
          yield* lodash.map(
            options.dependencies,
            (value, variable) => `import * as ${variable} from ${JSON.stringify(value)};`
          )
          yield
        }

        yield* topLevelCode
        yield
        yield `export ${generateParserExports()};`
        yield
        yield `export default ${generateParserObject()};`
        yield
      },
    }

    if (!(options.format in generators)) {
      throw Error(`Unknown \`options.format\`: ${options.format}`)
    }

    return generators[options.format]()
  }

  const value = join(
    generateWrapper(
      (function* () {
        yield `
      /**
       * @param {string} input
       * @param {Object} options
       * @param {"size"|"speed"=} options.optimize
       * @param {string[]=} options.allowedStartRules
       * @param {boolean=} options.cache
       * @param {boolean=} options.trace
       * @param {string=} options.filename
       */
      function peg$parse(input, options = {}) {
        const peg$FAILED = Symbol();
      
    `

        if (options.optimize === "size") {
          const startRuleIndices = `{ ${options.allowedStartRules
            .map(r => `${r}: ${ast.indexOfRule(r)}`)
            .join(", ")} }`
          const startRuleIndex = ast.indexOfRule(options.allowedStartRules[0])
          yield `
        const peg$startRuleIndices = ${startRuleIndices};
        let peg$startRuleIndex = ${startRuleIndex};
      `
        } else {
          const startRuleFunctions = `{ ${options.allowedStartRules
            .map(r => `${r}: peg$parse${r}`)
            .join(", ")} }`
          const startRuleFunction = `peg$parse${options.allowedStartRules[0]}`
          yield `
          const peg$startRuleFunctions = ${startRuleFunctions};
          let peg$startRuleFunction = ${startRuleFunction};
      `
        }

        yield
        yield* generateTables()
        yield `
      
        let peg$currPos = 0;
        let peg$savedPos = 0;
        const peg$posDetailsCache = [{ line: 1, column: 1 }];
        const peg$expected = [];
        let peg$silentFails = 0; // 0 = report failures, > 0 = silence failures
      
    `

        if (options.cache) {
          yield "  const peg$resultsCache = new Map();"
          yield
        }

        if (options.trace) {
          if (options.optimize === "size") {
            const ruleNames = `[${ast.rules.map(r => JSON.stringify(r.name)).join(", ")}]`
            yield `  const peg$ruleNames = ${ruleNames};`
            yield
          }

          if (use("DefaultTracer")) {
            yield "  const peg$tracer = options.tracer || new peg$DefaultTracer();"
            yield
          } else {
            yield "  const peg$tracer = options.tracer"
            yield
          }
        }

        yield "  let peg$result;"
        yield

        if (options.optimize === "size") {
          yield `
          if ("startRule" in options) {
            if (!(options.startRule in peg$startRuleIndices)) {
              throw new Error("Can’t start parsing from rule “" + options.startRule + "”.");
            }
        
            peg$startRuleIndex = peg$startRuleIndices[options.startRule];
          }
      `
        } else {
          yield `
          if ("startRule" in options) {
            if (!(options.startRule in peg$startRuleFunctions)) {
              throw new Error("Can’t start parsing from rule “" + options.startRule + "”.");
            }
        
            peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
          }
      `
        }

        if (use("text")) {
          yield `
        
          function text() {
            return input.substring(peg$savedPos, peg$currPos);
          }
      `
        }

        if (use("offset")) {
          yield
          yield "  function offset() {"
          yield "    return peg$savedPos;"
          yield "  }"
        }

        if (use("range")) {
          yield `
        function range() {
          return [peg$savedPos, peg$currPos];
        }
      `
        }

        if (use("location")) {
          yield `
        function location() {
          return peg$computeLocation(peg$savedPos, peg$currPos);
        }
      `
        }

        if (use("expected")) {
          yield `
        /**
         * @param {string} description
         */
        function expected(description, location = peg$computeLocation(peg$savedPos, peg$currPos)) {
          throw peg$buildStructuredError(
            [peg$otherExpectation(description)],
            input.substring(peg$savedPos, peg$currPos),
            location
          );
        }
      `
        }

        if (use("error")) {
          yield `
        
          /**
           * @param {string} message
           */
          function error(message, location = peg$computeLocation(peg$savedPos, peg$currPos)) {
            throw peg$buildSimpleError(message, location);
          }
      `
        }

        yield `
      /**
       * @param {number} pos
       */
      function peg$getPosDetails(pos) {
        let details = peg$posDetailsCache[pos];
        if (details == null) {
          details = peg$posDetailsCache[pos] = peg$computePosDetails(pos)
        }
        return details
      }
    
      /**
       * @param {number} pos
       */
      function peg$computePosDetails(pos) {
        let p = pos - 1;
        while (!peg$posDetailsCache[p]) {
          p--;
        }
  
        let { line, column } = peg$posDetailsCache[p];

        while (p < pos) {
          if (input[p] === "\\n") {
            line++;
            column = 1;
          } else {
            column++;
          }
  
          p++;
        }
  
        return { line, column };
      }
    `

        if (use("filename")) {
          yield '  const peg$VALID_FILENAME = typeof options.filename === "string" && options.filename.length > 0;'
        }

        yield `
      /**
       * @param {number} startPos
       * @param {number} endPos
       */
      function peg$computeLocation(startPos, endPos) {
        const loc = {};
    `

        if (use("filename")) {
          yield `if (peg$VALID_FILENAME) {
        loc.filename = options.filename;
      }`
        }

        yield `
        const startPosDetails = peg$getPosDetails(startPos);
        loc.start = {
          offset: startPos,
          line: startPosDetails.line,
          column: startPosDetails.column
        };
    
        const endPosDetails = peg$getPosDetails(endPos);
        loc.end = {
          offset: endPos,
          line: endPosDetails.line,
          column: endPosDetails.column
        };
    
        return loc;
      }
      
      function peg$begin() {
        peg$expected.push({ pos: peg$currPos, variants: [] });
      }
    
      function peg$expect(expected) {
        const top = peg$expected[peg$expected.length - 1];
    
        if (peg$currPos < top.pos) { return; }
    
        if (peg$currPos > top.pos) {
          top.pos = peg$currPos;
          top.variants = [];
        }
    
        top.variants.push(expected);
      }
      
      /**
       * @param {boolean} invert
       */
      function peg$end(invert) {
        const expected = peg$expected.pop();
        const top = peg$expected[peg$expected.length - 1];
        let variants = expected.variants;
    
        if (top.pos !== expected.pos) return;
    
        if (invert) {
          variants = variants.map(e =>
            e.type === "not" ? e.expected : { type: "not", expected: e }
          );
        }
    
        top.variants.push(...variants);
      }
    
      function peg$buildError() {
        const expected = peg$expected[0];
        const failPos = expected.pos;
    
        return peg$buildStructuredError(
          expected.variants,
          failPos < input.length ? input.charAt(failPos) : null,
          failPos < input.length
            ? peg$computeLocation(failPos, failPos + 1)
            : peg$computeLocation(failPos, failPos)
        );
      }
    `

        if (options.optimize === "size") {
          yield* generateInterpreter()
          yield
        } else {
          for (const rule of ast.rules) {
            yield* generateRuleFunction(rule)
            yield
          }
        }

        if (ast.initializer) {
          yield ast.initializer.code
          yield
        }

        yield "  peg$begin();"

        if (options.optimize === "size") {
          yield "  peg$result = peg$parseRule(peg$startRuleIndex);"
        } else {
          yield "  peg$result = peg$startRuleFunction();"
        }

        yield `
        if (peg$result !== peg$FAILED && peg$currPos === input.length) {
          return peg$result;
        } else {
          if (peg$result !== peg$FAILED && peg$currPos < input.length) {
            peg$expect(peg$endExpectation());
          }
      
          throw peg$buildError();
        }
      }
    `
      })()
    )
  )
  ast.code = value
}

function removeProxyRules(ast, session, options) {
  function isProxyRule(node) {
    return node.type === "rule" && node.expression.type === "rule_ref"
  }

  const replaceRuleRefs = session.buildVisitor({
    rule_ref(node, proxy, real) {
      if (node.name === proxy) {
        node.name = real
      }
    },
  })
  const allowedStartRules = options.allowedStartRules
  const rules = []
  ast.rules.forEach(rule => {
    if (isProxyRule(rule)) {
      replaceRuleRefs(ast, rule.name, rule.expression.name)
      if (!allowedStartRules.includes(rule.name)) return
    }

    rules.push(rule)
  })
  ast.rules = rules
}

function reportDuplicateLabels(ast, session) {
  function checkExpressionWithClonedEnv(node, env) {
    check(node.expression, { ...env })
  }

  const check = session.buildVisitor({
    rule(node) {
      check(node.expression, {})
    },

    choice(node, env) {
      node.alternatives.forEach(alternative => {
        check(alternative, { ...env })
      })
    },

    action: checkExpressionWithClonedEnv,

    labeled(node, env) {
      const label = node.label

      if (label && {}.hasOwnProperty.call(env, label)) {
        const start = env[label].start
        session.error(
          `Label "${label}" is already defined at line ${start.line}, column ${start.column}.`,
          node.location
        )
      }

      check(node.expression, env)
      if (label) env[label] = node.location
    },

    text: checkExpressionWithClonedEnv,
    simple_and: checkExpressionWithClonedEnv,
    simple_not: checkExpressionWithClonedEnv,
    optional: checkExpressionWithClonedEnv,
    zero_or_more: checkExpressionWithClonedEnv,
    one_or_more: checkExpressionWithClonedEnv,
    group: checkExpressionWithClonedEnv,
  })
  check(ast)
}

function reportDuplicateRules(ast, session) {
  const rules = new Map()
  const check = session.buildVisitor({
    rule(node) {
      const name = node.name

      if (rules.has(name)) {
        const start = rules.get(name).start
        session.error(
          `Rule "${name}" is already defined at line ${start.line}, column ${start.column}.`,
          node.location
        )
      }

      rules.set(node.name, node.location)
    },
  })
  check(ast)
}

function reportUnusedRules(ast, session, options) {
  const used = new Set()

  function yes(node) {
    used.add(node.name || node)
  }

  options.allowedStartRules.forEach(yes)
  session.buildVisitor({
    rule_ref: yes,
  })(ast)
  ast.rules.forEach(rule => {
    if (!used.has(rule.name)) {
      session.warn(`Rule "${rule.name}" is not referenced.`, rule.location)
    }
  })
}

function reportInfiniteRecursion(ast, session) {
  const visitedRules = []
  const check = session.buildVisitor({
    rule(node) {
      visitedRules.push(node.name)
      check(node.expression)
      visitedRules.pop()
    },

    sequence(node) {
      node.elements.every(element => {
        check(element)
        return !ast.alwaysConsumesOnSuccess(element)
      })
    },

    rule_ref(node) {
      if (visitedRules.includes(node.name)) {
        visitedRules.push(node.name)
        const rulePath = visitedRules.join(" -> ")
        session.error(
          `Possible infinite loop when parsing (left recursion: ${rulePath}).`,
          node.location
        )
      }

      check(ast.findRule(node.name))
    },
  })
  check(ast)
}

function reportInfiniteRepetition(ast, session) {
  const check = session.buildVisitor({
    zero_or_more(node) {
      if (!ast.alwaysConsumesOnSuccess(node.expression)) {
        session.error(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input).",
          node.location
        )
      }
    },

    one_or_more(node) {
      if (!ast.alwaysConsumesOnSuccess(node.expression)) {
        session.error(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input).",
          node.location
        )
      }
    },
  })
  check(ast)
}

function reportUndefinedRules(ast, session, options) {
  const check = session.buildVisitor({
    rule_ref(node) {
      if (!ast.findRule(node.name)) {
        session.error(`Rule "${node.name}" is not defined.`, node.location)
      }
    },
  })
  check(ast)
  options.allowedStartRules.forEach(rule => {
    if (!ast.findRule(rule)) {
      session.error(`Start rule "${rule}" is not defined.`)
    }
  })
}

function inferenceMatchResult(ast, session) {
  function sometimesMatch(node) {
    node.match = 0
    return node.match
  }

  function alwaysMatch(node) {
    inference(node.expression)
    node.match = 1
    return node.match
  }

  function inferenceExpression(node) {
    node.match = inference(node.expression)
    return node.match
  }

  function inferenceElements(elements, forChoice) {
    const length = elements.length
    let always = 0
    let never = 0

    for (let i = 0; i < length; ++i) {
      const result = inference(elements[i])

      if (result > 0) {
        ++always
      }

      if (result < 0) {
        ++never
      }
    }

    if (always === length) {
      return 1
    }

    if (forChoice) {
      return never === length ? -1 : 0
    }

    return never > 0 ? -1 : 0
  }

  const inference = session.buildVisitor({
    rule(node) {
      let oldResult
      let count = 0

      if (node.match === undefined) {
        node.match = 0

        do {
          oldResult = node.match
          node.match = inference(node.expression)

          if (++count > 6) {
            session.error(
              "Infinity cycle detected when trying to evaluate node match result",
              node.location
            )
          }
        } while (oldResult !== node.match)
      }

      return node.match
    },

    named: inferenceExpression,

    choice(node) {
      node.match = inferenceElements(node.alternatives, true)
      return node.match
    },

    action: inferenceExpression,

    sequence(node) {
      node.match = inferenceElements(node.elements, false)
      return node.match
    },

    labeled: inferenceExpression,
    text: inferenceExpression,
    simple_and: inferenceExpression,

    simple_not(node) {
      node.match = -inference(node.expression)
      return node.match
    },

    optional: alwaysMatch,
    zero_or_more: alwaysMatch,
    one_or_more: inferenceExpression,
    group: inferenceExpression,
    semantic_and: sometimesMatch,
    semantic_not: sometimesMatch,

    rule_ref(node) {
      const rule = ast.findRule(node.name)
      node.match = inference(rule)
      return node.match
    },

    literal(node) {
      node.match = node.value.length === 0 ? 1 : 0
      return node.match
    },

    class(node) {
      node.match = node.parts.length === 0 ? -1 : 0
      return node.match
    },

    any: sometimesMatch,
  })
  inference(ast)
}

function isSemanticPredicate(element) {
  const type = element.expression.type
  if (type === "semantic_and") return true
  if (type === "semantic_not") return true
  return false
}

function reportIncorrectPlucking(ast, session) {
  session.buildVisitor({
    action(node) {
      this.visit(node.expression, true)
    },

    labeled(node, action) {
      if (node.pick !== true) return void 0
      if (action === true)
        session.error(`"@" cannot be used with an action block.`, node.location)
      if (isSemanticPredicate(node))
        session.error(`"@" cannot be used on a semantic predicate.`, node.location)
      this.visit(node.expression)
    },
  })(ast)
}

let opcodes

;(function (opcodes) {
  opcodes[(opcodes["PUSH_EMPTY_STRING"] = 0)] = "PUSH_EMPTY_STRING"
  opcodes[(opcodes["PUSH_UNDEFINED"] = 1)] = "PUSH_UNDEFINED"
  opcodes[(opcodes["PUSH_NULL"] = 2)] = "PUSH_NULL"
  opcodes[(opcodes["PUSH_FAILED"] = 3)] = "PUSH_FAILED"
  opcodes[(opcodes["PUSH_EMPTY_ARRAY"] = 4)] = "PUSH_EMPTY_ARRAY"
  opcodes[(opcodes["PUSH_CURR_POS"] = 5)] = "PUSH_CURR_POS"
  opcodes[(opcodes["POP"] = 6)] = "POP"
  opcodes[(opcodes["POP_CURR_POS"] = 7)] = "POP_CURR_POS"
  opcodes[(opcodes["POP_N"] = 8)] = "POP_N"
  opcodes[(opcodes["NIP"] = 9)] = "NIP"
  opcodes[(opcodes["APPEND"] = 10)] = "APPEND"
  opcodes[(opcodes["WRAP"] = 11)] = "WRAP"
  opcodes[(opcodes["TEXT"] = 12)] = "TEXT"
  opcodes[(opcodes["PLUCK"] = 41)] = "PLUCK"
  opcodes[(opcodes["IF"] = 13)] = "IF"
  opcodes[(opcodes["IF_ERROR"] = 14)] = "IF_ERROR"
  opcodes[(opcodes["IF_NOT_ERROR"] = 15)] = "IF_NOT_ERROR"
  opcodes[(opcodes["WHILE_NOT_ERROR"] = 16)] = "WHILE_NOT_ERROR"
  opcodes[(opcodes["MATCH_ANY"] = 17)] = "MATCH_ANY"
  opcodes[(opcodes["MATCH_STRING"] = 18)] = "MATCH_STRING"
  opcodes[(opcodes["MATCH_STRING_IC"] = 19)] = "MATCH_STRING_IC"
  opcodes[(opcodes["MATCH_CLASS"] = 20)] = "MATCH_CLASS"
  opcodes[(opcodes["ACCEPT_N"] = 21)] = "ACCEPT_N"
  opcodes[(opcodes["ACCEPT_STRING"] = 22)] = "ACCEPT_STRING"
  opcodes[(opcodes["EXPECT"] = 23)] = "EXPECT"
  opcodes[(opcodes["LOAD_SAVED_POS"] = 24)] = "LOAD_SAVED_POS"
  opcodes[(opcodes["UPDATE_SAVED_POS"] = 25)] = "UPDATE_SAVED_POS"
  opcodes[(opcodes["CALL"] = 26)] = "CALL"
  opcodes[(opcodes["RULE"] = 27)] = "RULE"
  opcodes[(opcodes["SILENT_FAILS_ON"] = 28)] = "SILENT_FAILS_ON"
  opcodes[(opcodes["SILENT_FAILS_OFF"] = 29)] = "SILENT_FAILS_OFF"
  opcodes[(opcodes["EXPECT_NS_BEGIN"] = 38)] = "EXPECT_NS_BEGIN"
  opcodes[(opcodes["EXPECT_NS_END"] = 39)] = "EXPECT_NS_END"
})(opcodes || (opcodes = {}))

class GrammarError {
  constructor(message, location) {
    var _Error$captureStackTr

    this.name = void 0
    this.message = message
    this.location = location
    this.name = "GrammarError"
    ;(_Error$captureStackTr = Error.captureStackTrace) === null ||
    _Error$captureStackTr === void 0
      ? void 0
      : _Error$captureStackTr.call(Error, this, GrammarError)
  }
}

class ASTVisitor {
  constructor(visitors) {
    Object.assign(this, visitors)
    this.visit = this.visit.bind(this)
  }

  visit(node, ..._args) {
    if (!node) {
      throw new Error("Visitor function called with no arguments or a `falsy` node")
    }

    const fn = this[node.type]

    if (!fn) {
      console.debug(node)
      throw new Error(`Visitor function for node type "${node.type}" not defined`)
    }

    return fn.apply(this, arguments)
  }

  grammar(node, ...extraArgs) {
    if (node.initializer) {
      this.visit(node.initializer, ...extraArgs)
    }

    node.rules.forEach(rule => {
      this.visit(rule, ...extraArgs)
    })
  }

  choice(node, ...extraArgs) {
    node.alternatives.forEach(child => this.visit(child, ...extraArgs))
  }

  sequence(node, ...extraArgs) {
    node.elements.forEach(child => this.visit(child, ...extraArgs))
  }
}
Object.assign(ASTVisitor.prototype, {
  initializer: lodash.noop,
  rule: visitExpression,
  named: visitExpression,
  action: visitExpression,
  labeled: visitExpression,
  text: visitExpression,
  simple_and: visitExpression,
  simple_not: visitExpression,
  optional: visitExpression,
  zero_or_more: visitExpression,
  one_or_more: visitExpression,
  group: visitExpression,
  semantic_and: lodash.noop,
  semantic_not: lodash.noop,
  rule_ref: lodash.noop,
  literal: lodash.noop,
  class: lodash.noop,
  any: lodash.noop,
})
function build(functions) {
  return new ASTVisitor(functions).visit
}

function visitExpression(node, ...extraArgs) {
  this.visit(node.expression, ...extraArgs)
}

var visitor = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  ASTVisitor: ASTVisitor,
  build: build,
})

class Node {
  constructor(type, location) {
    this.type = type
    this.location = location
    this.type = type
    this.location = location
  }
}

class Grammar extends Node {
  constructor(initializer, rules, comments, location) {
    super("grammar", location)
    this._alwaysConsumesOnSuccess = void 0
    this.initializer = initializer
    this.comments = comments
    this.rules = rules
    this._alwaysConsumesOnSuccess = new AlwaysConsumesOnSuccess(this)
  }

  alwaysConsumesOnSuccess(node) {
    return this._alwaysConsumesOnSuccess.visit(node)
  }

  findRule(name) {
    return this.rules.find(rule => rule.name === name)
  }

  indexOfRule(name) {
    return this.rules.findIndex(rule => rule.name === name)
  }
}

class AlwaysConsumesOnSuccess extends ASTVisitor {
  constructor(ast) {
    super()
    this.ast = ast
  }

  choice(node) {
    return node.alternatives.every(this.visit, this)
  }

  sequence(node) {
    return node.elements.some(this.visit, this)
  }

  rule_ref(node) {
    return this.visit(this.ast.findRule(node.name))
  }

  literal(node) {
    return node.value !== ""
  }
}

function consumesTrue() {
  return true
}

function consumesFalse() {
  return false
}

function consumesExpression(node) {
  return this.visit(node.expression)
}

Object.assign(AlwaysConsumesOnSuccess.prototype, {
  rule: consumesExpression,
  named: consumesExpression,
  action: consumesExpression,
  labeled: consumesExpression,
  text: consumesExpression,
  simple_and: consumesFalse,
  simple_not: consumesFalse,
  optional: consumesFalse,
  zero_or_more: consumesFalse,
  one_or_more: consumesExpression,
  group: consumesExpression,
  semantic_and: consumesFalse,
  semantic_not: consumesFalse,
  class: consumesTrue,
  any: consumesTrue,
})

var mod$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  visitor: visitor,
  Grammar: Grammar,
  Node: Node,
})

class peg$SyntaxError$1 extends Error {
  constructor(message, expected, found, location) {
    var _Error$captureStackTr

    super(message)
    this.expected = expected
    this.found = found
    this.location = location
    this.expected = expected
    this.name = "PEG.SyntaxError"
    ;(_Error$captureStackTr = Error.captureStackTrace) === null ||
    _Error$captureStackTr === void 0
      ? void 0
      : _Error$captureStackTr.call(Error, this, peg$SyntaxError$1)
  }

  static buildMessage(expected, found) {
    const DESCRIBE_EXPECTATION_FNS = {
      literal: ({ text }) => `"${literalEscape(text)}"`,
      class: ({ inverted, parts }) =>
        "[" +
        (inverted ? "^" : "") +
        parts
          .map(part =>
            Array.isArray(part)
              ? `${classEscape(part[0])}-${classEscape(part[1])}`
              : classEscape(part)
          )
          .join("") +
        "]",
      any: () => "any character",
      end: () => "end of input",
      other: ({ description }) => description,
      not: ({ expected }) => describeExpectation(expected),
    }

    function hex(ch) {
      return ch.charCodeAt(0).toString(16).toUpperCase()
    }

    function literalEscape(s) {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\0/g, "\\0")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch))
        .replace(/[\x10-\x1F\x7F-\x9F]/g, ch => "\\x" + hex(ch))
    }

    function classEscape(s) {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/\]/g, "\\]")
        .replace(/\^/g, "\\^")
        .replace(/-/g, "\\-")
        .replace(/\0/g, "\\0")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch))
        .replace(/[\x10-\x1F\x7F-\x9F]/g, ch => "\\x" + hex(ch))
    }

    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation)
    }

    return `Expected ${(function (expected) {
      const descriptions = expected.map(describeExpectation).sort()

      if (descriptions.length > 0) {
        let j = 1

        for (let i = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i]
            j++
          }
        }

        descriptions.length = j
      }

      switch (descriptions.length) {
        case 1:
          return descriptions[0]

        case 2:
          return `${descriptions[0]} or ${descriptions[1]}`

        default:
          return (
            descriptions.slice(0, -1).join(", ") +
            ", or " +
            descriptions[descriptions.length - 1]
          )
      }
    })(expected)} but ${(function (found) {
      return found ? `"${literalEscape(found)}"` : "end of input"
    })(found)} found.`
  }
}

function peg$buildSimpleError$1(message, location) {
  return new peg$SyntaxError$1(message, null, null, location)
}

function peg$buildStructuredError$1(expected, found, location) {
  return new peg$SyntaxError$1(
    peg$SyntaxError$1.buildMessage(expected, found, location),
    expected,
    found,
    location
  )
}

function peg$literalExpectation$1(text, ignoreCase) {
  return {
    type: "literal",
    text,
    ignoreCase,
  }
}

function peg$classExpectation$1(parts, inverted, ignoreCase) {
  return {
    type: "class",
    parts,
    inverted,
    ignoreCase,
  }
}

function peg$anyExpectation$1() {
  return {
    type: "any",
  }
}

function peg$endExpectation$1() {
  return {
    type: "end",
  }
}

function peg$otherExpectation$1(description) {
  return {
    type: "other",
    description,
  }
}

function peg$parse(input, options = {}) {
  const peg$FAILED = Symbol()
  const peg$startRuleFunctions = {
    Grammar: peg$parseGrammar,
  }
  let peg$startRuleFunction = peg$parseGrammar
  const peg$c0 = "="
  const peg$c1 = "/"
  const peg$c4 = "$"
  const peg$c5 = "&"
  const peg$c6 = "!"
  const peg$c19 = "\r\n"
  const peg$c23 = "/*"
  const peg$c24 = "*/"
  const peg$c25 = "//"
  const peg$c27 = "\\"
  const peg$c30 = "i"
  const peg$c31 = '"'
  const peg$c32 = "'"
  const peg$c35 = "]"
  const peg$c44 = "x"
  const peg$c45 = "u"
  const peg$c47 = "{"
  const peg$c48 = "}"
  const peg$r3 = /^[{}]/
  const peg$e0 = peg$literalExpectation$1("=", false)
  const peg$e1 = peg$literalExpectation$1("/", false)
  const peg$e2 = peg$literalExpectation$1("@", false)
  const peg$e3 = peg$literalExpectation$1(":", false)
  const peg$e4 = peg$literalExpectation$1("$", false)
  const peg$e5 = peg$literalExpectation$1("&", false)
  const peg$e6 = peg$literalExpectation$1("!", false)
  const peg$e7 = peg$literalExpectation$1("?", false)
  const peg$e8 = peg$literalExpectation$1("*", false)
  const peg$e9 = peg$literalExpectation$1("+", false)
  const peg$e10 = peg$literalExpectation$1("(", false)
  const peg$e11 = peg$literalExpectation$1(")", false)
  const peg$e12 = peg$anyExpectation$1()
  const peg$e13 = peg$otherExpectation$1("whitespace")
  const peg$e14 = peg$classExpectation$1(["\n", "\r", "\u2028", "\u2029"], false, false)
  const peg$e15 = peg$otherExpectation$1("end of line")
  const peg$e16 = peg$otherExpectation$1("comment")
  const peg$e17 = peg$literalExpectation$1("/*", false)
  const peg$e18 = peg$literalExpectation$1("*/", false)
  const peg$e19 = peg$literalExpectation$1("//", false)
  const peg$e20 = peg$otherExpectation$1("identifier")
  const peg$e21 = peg$otherExpectation$1("literal")
  const peg$e22 = peg$otherExpectation$1("string")
  const peg$e23 = peg$otherExpectation$1("character class")
  const peg$e24 = peg$literalExpectation$1(".", false)
  const peg$e25 = peg$otherExpectation$1("code block")
  const peg$e26 = peg$literalExpectation$1(";", false)

  const peg$f0 = (initializer, rules) =>
    new Grammar(initializer, rules, comments, location())

  const peg$f1 = code =>
    createNode("initializer", {
      code,
    })

  const peg$f2 = function (name, displayName, expression) {
    if (displayName) {
      expression = createNode("named", {
        name: displayName,
        expression,
      })
    }

    return createNode("rule", {
      name,
      expression,
    })
  }

  const peg$f3 = function (head, tail) {
    if (tail.length === 0) return head
    return createNode("choice", {
      alternatives: [head].concat(tail),
    })
  }

  const peg$f4 = function (expression, code) {
    if (code === null) return expression
    return createNode("action", {
      expression,
      code,
    })
  }

  const peg$f5 = function (head, tail) {
    let elements = [head]

    if (tail.length === 0) {
      if (head.type !== "labeled" || !head.pick) return head
    } else {
      elements = elements.concat(tail)
    }

    return createNode("sequence", {
      elements,
    })
  }

  const peg$f6 = (label, expression) =>
    createNode("labeled", {
      pick,
      label,
      expression,
    })

  const peg$f7 = (label, expression) =>
    createNode("labeled", {
      label,
      expression,
    })

  const peg$f8 = function (name) {
    if (!RESERVED_WORDS.has(name)) return name
    error(`Label can't be a reserved word "${name}".`, location())
  }

  const peg$f9 = (operator, expression) =>
    createNode(operator, {
      expression,
    })

  const peg$f10 = () => "text"

  const peg$f11 = () => "simple_and"

  const peg$f12 = () => "simple_not"

  const peg$f13 = (expression, operator) =>
    createNode(operator, {
      expression,
    })

  const peg$f14 = () => "optional"

  const peg$f15 = () => "zero_or_more"

  const peg$f16 = () => "one_or_more"

  const peg$f17 = function (e) {
    if (e.type !== "labeled" && e.type !== "sequence") return e
    return createNode("group", {
      expression: e,
    })
  }

  const peg$f18 = name =>
    createNode("rule_ref", {
      name,
    })

  const peg$f19 = (operator, code) =>
    createNode(operator, {
      code,
    })

  const peg$f20 = () => "semantic_and"

  const peg$f21 = () => "semantic_not"

  const peg$f22 = comment => addComment(comment, true)

  const peg$f23 = comment => addComment(comment, false)

  const peg$f24 = (head, tail) => head + tail.join("")

  const peg$f25 = (value, ignoreCase) =>
    createNode("literal", {
      value,
      ignoreCase: ignoreCase !== null,
    })

  const peg$f26 = chars => chars.join("")

  const peg$f27 = (inverted, parts, ignoreCase) =>
    createNode("class", {
      parts: parts.filter(part => part !== ""),
      inverted: inverted !== null,
      ignoreCase: ignoreCase !== null,
    })

  const peg$f28 = function (begin, end) {
    if (begin.charCodeAt(0) > end.charCodeAt(0)) {
      error("Invalid character range: " + text() + ".")
    }

    return [begin, end]
  }

  const peg$f29 = () => ""

  const peg$f30 = () => "\0"

  const peg$f31 = () => "\b"

  const peg$f32 = () => "\f"

  const peg$f33 = () => "\n"

  const peg$f34 = () => "\r"

  const peg$f35 = () => "\t"

  const peg$f36 = () => "\v"

  const peg$f37 = digits => String.fromCharCode(parseInt(digits, 16))

  const peg$f38 = () => createNode("any")

  const peg$f39 = function () {
    error("Unbalanced brace.")
  }

  let peg$currPos = 0
  let peg$savedPos = 0
  const peg$posDetailsCache = [
    {
      line: 1,
      column: 1,
    },
  ]
  const peg$expected = []
  let peg$silentFails = 0
  let peg$result

  if ("startRule" in options) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error("Can’t start parsing from rule “" + options.startRule + "”.")
    }

    peg$startRuleFunction = peg$startRuleFunctions[options.startRule]
  }

  function text() {
    return input.substring(peg$savedPos, peg$currPos)
  }

  function location() {
    return peg$computeLocation(peg$savedPos, peg$currPos)
  }

  function error(message, location = peg$computeLocation(peg$savedPos, peg$currPos)) {
    throw peg$buildSimpleError$1(message, location)
  }

  function peg$getPosDetails(pos) {
    let details = peg$posDetailsCache[pos]

    if (details == null) {
      details = peg$posDetailsCache[pos] = peg$computePosDetails(pos)
    }

    return details
  }

  function peg$computePosDetails(pos) {
    let p = pos - 1

    while (!peg$posDetailsCache[p]) {
      p--
    }

    let { line, column } = peg$posDetailsCache[p]

    while (p < pos) {
      if (input[p] === "\n") {
        line++
        column = 1
      } else {
        column++
      }

      p++
    }

    return {
      line,
      column,
    }
  }

  const peg$VALID_FILENAME =
    typeof options.filename === "string" && options.filename.length > 0

  function peg$computeLocation(startPos, endPos) {
    const loc = {}

    if (peg$VALID_FILENAME) {
      loc.filename = options.filename
    }

    const startPosDetails = peg$getPosDetails(startPos)
    loc.start = {
      offset: startPos,
      line: startPosDetails.line,
      column: startPosDetails.column,
    }
    const endPosDetails = peg$getPosDetails(endPos)
    loc.end = {
      offset: endPos,
      line: endPosDetails.line,
      column: endPosDetails.column,
    }
    return loc
  }

  function peg$begin() {
    peg$expected.push({
      pos: peg$currPos,
      variants: [],
    })
  }

  function peg$expect(expected) {
    const top = peg$expected[peg$expected.length - 1]

    if (peg$currPos < top.pos) {
      return
    }

    if (peg$currPos > top.pos) {
      top.pos = peg$currPos
      top.variants = []
    }

    top.variants.push(expected)
  }

  function peg$end(invert) {
    const expected = peg$expected.pop()
    const top = peg$expected[peg$expected.length - 1]
    let variants = expected.variants
    if (top.pos !== expected.pos) return

    if (invert) {
      variants = variants.map(e =>
        e.type === "not"
          ? e.expected
          : {
              type: "not",
              expected: e,
            }
      )
    }

    top.variants.push(...variants)
  }

  function peg$buildError() {
    const expected = peg$expected[0]
    const failPos = expected.pos
    return peg$buildStructuredError$1(
      expected.variants,
      failPos < input.length ? input.charAt(failPos) : null,
      failPos < input.length
        ? peg$computeLocation(failPos, failPos + 1)
        : peg$computeLocation(failPos, failPos)
    )
  }

  function peg$parseGrammar() {
    let s0, s2, s3, s4, s5
    s0 = peg$currPos
    peg$parse__()
    s2 = peg$currPos
    s3 = peg$parseInitializer()

    if (s3 !== peg$FAILED) {
      s4 = peg$parse__()
      s2 = s3
    } else {
      peg$currPos = s2
      s2 = peg$FAILED
    }

    if (s2 === peg$FAILED) {
      s2 = null
    }

    s3 = []
    s4 = peg$currPos
    s5 = peg$parseRule()

    if (s5 !== peg$FAILED) {
      peg$parse__()
      s4 = s5
    } else {
      peg$currPos = s4
      s4 = peg$FAILED
    }

    if (s4 !== peg$FAILED) {
      while (s4 !== peg$FAILED) {
        s3.push(s4)
        s4 = peg$currPos
        s5 = peg$parseRule()

        if (s5 !== peg$FAILED) {
          peg$parse__()
          s4 = s5
        } else {
          peg$currPos = s4
          s4 = peg$FAILED
        }
      }
    } else {
      s3 = peg$FAILED
    }

    if (s3 !== peg$FAILED) {
      peg$savedPos = s0
      s0 = peg$f0(s2, s3)
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseInitializer() {
    let s0, s1, s2
    s0 = peg$currPos
    s1 = peg$parseCodeBlock()

    if (s1 !== peg$FAILED) {
      s2 = peg$parseEOS()

      if (s2 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f1(s1)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseRule() {
    let s0, s1, s3, s4, s6, s7

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    s1 = peg$parseIdentifier()

    if (s1 !== peg$FAILED) {
      peg$parse__()
      s3 = peg$currPos
      s4 = peg$parseStringLiteral()

      if (s4 !== peg$FAILED) {
        peg$parse__()
        s3 = s4
      } else {
        peg$currPos = s3
        s3 = peg$FAILED
      }

      if (s3 === peg$FAILED) {
        s3 = null
      }

      rule$expects(peg$e0)

      if (input.charCodeAt(peg$currPos) === 61) {
        s4 = peg$c0
        peg$currPos++
      } else {
        s4 = peg$FAILED
      }

      if (s4 !== peg$FAILED) {
        peg$parse__()
        s6 = peg$parseChoiceExpression()

        if (s6 !== peg$FAILED) {
          s7 = peg$parseEOS()

          if (s7 !== peg$FAILED) {
            peg$savedPos = s0
            s0 = peg$f2(s1, s3, s6)
          } else {
            peg$currPos = s0
            s0 = peg$FAILED
          }
        } else {
          peg$currPos = s0
          s0 = peg$FAILED
        }
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseChoiceExpression() {
    let s0, s1, s2, s3, s5, s7

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    s1 = peg$parseActionExpression()

    if (s1 !== peg$FAILED) {
      s2 = []
      s3 = peg$currPos
      peg$parse__()
      rule$expects(peg$e1)

      if (input.charCodeAt(peg$currPos) === 47) {
        s5 = peg$c1
        peg$currPos++
      } else {
        s5 = peg$FAILED
      }

      if (s5 !== peg$FAILED) {
        peg$parse__()
        s7 = peg$parseActionExpression()

        if (s7 !== peg$FAILED) {
          s3 = s7
        } else {
          peg$currPos = s3
          s3 = peg$FAILED
        }
      } else {
        peg$currPos = s3
        s3 = peg$FAILED
      }

      while (s3 !== peg$FAILED) {
        s2.push(s3)
        s3 = peg$currPos
        peg$parse__()
        rule$expects(peg$e1)

        if (input.charCodeAt(peg$currPos) === 47) {
          s5 = peg$c1
          peg$currPos++
        } else {
          s5 = peg$FAILED
        }

        if (s5 !== peg$FAILED) {
          peg$parse__()
          s7 = peg$parseActionExpression()

          if (s7 !== peg$FAILED) {
            s3 = s7
          } else {
            peg$currPos = s3
            s3 = peg$FAILED
          }
        } else {
          peg$currPos = s3
          s3 = peg$FAILED
        }
      }

      peg$savedPos = s0
      s0 = peg$f3(s1, s2)
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseActionExpression() {
    let s0, s1, s2, s4
    s0 = peg$currPos
    s1 = peg$parseSequenceExpression()

    if (s1 !== peg$FAILED) {
      s2 = peg$currPos
      peg$parse__()
      s4 = peg$parseCodeBlock()

      if (s4 !== peg$FAILED) {
        s2 = s4
      } else {
        peg$currPos = s2
        s2 = peg$FAILED
      }

      if (s2 === peg$FAILED) {
        s2 = null
      }

      peg$savedPos = s0
      s0 = peg$f4(s1, s2)
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseSequenceExpression() {
    let s0, s1, s2, s3, s5
    s0 = peg$currPos
    s1 = peg$parseLabeledExpression()

    if (s1 !== peg$FAILED) {
      s2 = []
      s3 = peg$currPos
      peg$parse__()
      s5 = peg$parseLabeledExpression()

      if (s5 !== peg$FAILED) {
        s3 = s5
      } else {
        peg$currPos = s3
        s3 = peg$FAILED
      }

      while (s3 !== peg$FAILED) {
        s2.push(s3)
        s3 = peg$currPos
        peg$parse__()
        s5 = peg$parseLabeledExpression()

        if (s5 !== peg$FAILED) {
          s3 = s5
        } else {
          peg$currPos = s3
          s3 = peg$FAILED
        }
      }

      peg$savedPos = s0
      s0 = peg$f5(s1, s2)
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseLabeledExpression() {
    let s0, s1, s2, s3, s4

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    rule$expects(peg$e2)

    if (input.charCodeAt(peg$currPos) === 64) {
      s1 = "@"
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$parseLabelIdentifier()

      if (s2 === peg$FAILED) {
        s2 = null
      }

      s3 = peg$parse__()
      s4 = peg$parsePrefixedExpression()

      if (s4 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f6(s2, s4)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      s0 = peg$currPos
      s1 = peg$parseLabelIdentifier()

      if (s1 !== peg$FAILED) {
        s2 = peg$parse__()
        s3 = peg$parsePrefixedExpression()

        if (s3 !== peg$FAILED) {
          peg$savedPos = s0
          s0 = peg$f7(s1, s3)
        } else {
          peg$currPos = s0
          s0 = peg$FAILED
        }
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }

      if (s0 === peg$FAILED) {
        s0 = peg$parsePrefixedExpression()
      }
    }

    return s0
  }

  function peg$parseLabelIdentifier() {
    let s0, s1, s3

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    s1 = peg$parseIdentifier()

    if (s1 !== peg$FAILED) {
      peg$parse__()
      rule$expects(peg$e3)

      if (input.charCodeAt(peg$currPos) === 58) {
        s3 = ":"
        peg$currPos++
      } else {
        s3 = peg$FAILED
      }

      if (s3 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f8(s1)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parsePrefixedExpression() {
    let s0, s1, s3
    s0 = peg$currPos
    s1 = peg$parsePrefixedOperator()

    if (s1 !== peg$FAILED) {
      peg$parse__()
      s3 = peg$parseSuffixedExpression()

      if (s3 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f9(s1, s3)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      s0 = peg$parseSuffixedExpression()
    }

    return s0
  }

  function peg$parsePrefixedOperator() {
    let s0, s1

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    rule$expects(peg$e4)

    if (input.charCodeAt(peg$currPos) === 36) {
      s1 = peg$c4
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      peg$savedPos = s0
      s1 = peg$f10()
    }

    s0 = s1

    if (s0 === peg$FAILED) {
      s0 = peg$currPos
      rule$expects(peg$e5)

      if (input.charCodeAt(peg$currPos) === 38) {
        s1 = peg$c5
        peg$currPos++
      } else {
        s1 = peg$FAILED
      }

      if (s1 !== peg$FAILED) {
        peg$savedPos = s0
        s1 = peg$f11()
      }

      s0 = s1

      if (s0 === peg$FAILED) {
        s0 = peg$currPos
        rule$expects(peg$e6)

        if (input.charCodeAt(peg$currPos) === 33) {
          s1 = peg$c6
          peg$currPos++
        } else {
          s1 = peg$FAILED
        }

        if (s1 !== peg$FAILED) {
          peg$savedPos = s0
          s1 = peg$f12()
        }

        s0 = s1
      }
    }

    return s0
  }

  function peg$parseSuffixedExpression() {
    let s0, s1, s3
    s0 = peg$currPos
    s1 = peg$parsePrimaryExpression()

    if (s1 !== peg$FAILED) {
      peg$parse__()
      s3 = peg$parseSuffixedOperator()

      if (s3 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f13(s1, s3)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      s0 = peg$parsePrimaryExpression()
    }

    return s0
  }

  function peg$parseSuffixedOperator() {
    let s0, s1

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    rule$expects(peg$e7)

    if (input.charCodeAt(peg$currPos) === 63) {
      s1 = "?"
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      peg$savedPos = s0
      s1 = peg$f14()
    }

    s0 = s1

    if (s0 === peg$FAILED) {
      s0 = peg$currPos
      rule$expects(peg$e8)

      if (input.charCodeAt(peg$currPos) === 42) {
        s1 = "*"
        peg$currPos++
      } else {
        s1 = peg$FAILED
      }

      if (s1 !== peg$FAILED) {
        peg$savedPos = s0
        s1 = peg$f15()
      }

      s0 = s1

      if (s0 === peg$FAILED) {
        s0 = peg$currPos
        rule$expects(peg$e9)

        if (input.charCodeAt(peg$currPos) === 43) {
          s1 = "+"
          peg$currPos++
        } else {
          s1 = peg$FAILED
        }

        if (s1 !== peg$FAILED) {
          peg$savedPos = s0
          s1 = peg$f16()
        }

        s0 = s1
      }
    }

    return s0
  }

  function peg$parsePrimaryExpression() {
    let s0, s1, s3, s5

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$parseLiteralMatcher()

    if (s0 === peg$FAILED) {
      s0 = peg$parseCharacterClassMatcher()

      if (s0 === peg$FAILED) {
        s0 = peg$parseAnyMatcher()

        if (s0 === peg$FAILED) {
          s0 = peg$parseRuleReferenceExpression()

          if (s0 === peg$FAILED) {
            s0 = peg$parseSemanticPredicateExpression()

            if (s0 === peg$FAILED) {
              s0 = peg$currPos
              rule$expects(peg$e10)

              if (input.charCodeAt(peg$currPos) === 40) {
                s1 = "("
                peg$currPos++
              } else {
                s1 = peg$FAILED
              }

              if (s1 !== peg$FAILED) {
                peg$parse__()
                s3 = peg$parseChoiceExpression()

                if (s3 !== peg$FAILED) {
                  peg$parse__()
                  rule$expects(peg$e11)

                  if (input.charCodeAt(peg$currPos) === 41) {
                    s5 = ")"
                    peg$currPos++
                  } else {
                    s5 = peg$FAILED
                  }

                  if (s5 !== peg$FAILED) {
                    peg$savedPos = s0
                    s0 = peg$f17(s3)
                  } else {
                    peg$currPos = s0
                    s0 = peg$FAILED
                  }
                } else {
                  peg$currPos = s0
                  s0 = peg$FAILED
                }
              } else {
                peg$currPos = s0
                s0 = peg$FAILED
              }
            }
          }
        }
      }
    }

    return s0
  }

  function peg$parseRuleReferenceExpression() {
    let s0, s1, s2, s3, s4, s5, s6, s7

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    s1 = peg$parseIdentifier()

    if (s1 !== peg$FAILED) {
      s2 = peg$currPos
      peg$begin()
      s3 = peg$currPos
      s4 = peg$parse__()
      s5 = peg$currPos
      s6 = peg$parseStringLiteral()

      if (s6 !== peg$FAILED) {
        s7 = peg$parse__()
        s6 = [s6, s7]
        s5 = s6
      } else {
        peg$currPos = s5
        s5 = peg$FAILED
      }

      if (s5 === peg$FAILED) {
        s5 = null
      }

      rule$expects(peg$e0)

      if (input.charCodeAt(peg$currPos) === 61) {
        s6 = peg$c0
        peg$currPos++
      } else {
        s6 = peg$FAILED
      }

      if (s6 !== peg$FAILED) {
        s4 = [s4, s5, s6]
        s3 = s4
      } else {
        peg$currPos = s3
        s3 = peg$FAILED
      }

      peg$end(true)

      if (s3 === peg$FAILED) {
        s2 = undefined
      } else {
        peg$currPos = s2
        s2 = peg$FAILED
      }

      if (s2 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f18(s1)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseSemanticPredicateExpression() {
    let s0, s1, s3
    s0 = peg$currPos
    s1 = peg$parseSemanticPredicateOperator()

    if (s1 !== peg$FAILED) {
      peg$parse__()
      s3 = peg$parseCodeBlock()

      if (s3 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f19(s1, s3)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseSemanticPredicateOperator() {
    let s0, s1

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    rule$expects(peg$e5)

    if (input.charCodeAt(peg$currPos) === 38) {
      s1 = peg$c5
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      peg$savedPos = s0
      s1 = peg$f20()
    }

    s0 = s1

    if (s0 === peg$FAILED) {
      s0 = peg$currPos
      rule$expects(peg$e6)

      if (input.charCodeAt(peg$currPos) === 33) {
        s1 = peg$c6
        peg$currPos++
      } else {
        s1 = peg$FAILED
      }

      if (s1 !== peg$FAILED) {
        peg$savedPos = s0
        s1 = peg$f21()
      }

      s0 = s1
    }

    return s0
  }

  function peg$parseSourceCharacter() {
    let s0

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    rule$expects(peg$e12)

    if (input.length > peg$currPos) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseWhiteSpace() {
    let s0

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    rule$expects(peg$e13)
    peg$silentFails++

    if (input.charCodeAt(peg$currPos) === 9) {
      s0 = "\t"
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 11) {
        s0 = "\x0B"
        peg$currPos++
      } else {
        s0 = peg$FAILED
      }

      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 12) {
          s0 = "\f"
          peg$currPos++
        } else {
          s0 = peg$FAILED
        }

        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 32) {
            s0 = " "
            peg$currPos++
          } else {
            s0 = peg$FAILED
          }

          if (s0 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 160) {
              s0 = "\xA0"
              peg$currPos++
            } else {
              s0 = peg$FAILED
            }

            if (s0 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 65279) {
                s0 = "\uFEFF"
                peg$currPos++
              } else {
                s0 = peg$FAILED
              }

              if (s0 === peg$FAILED) {
                s0 = peg$parseZs()
              }
            }
          }
        }
      }
    }

    peg$silentFails--
    return s0
  }

  function peg$parseLineTerminator() {
    let s0

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    rule$expects(peg$e14)

    if (/^[\n\r\u2028\u2029]/.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseLineTerminatorSequence() {
    let s0

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    rule$expects(peg$e15)
    peg$silentFails++

    if (input.charCodeAt(peg$currPos) === 10) {
      s0 = "\n"
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 2) === peg$c19) {
        s0 = peg$c19
        peg$currPos += 2
      } else {
        s0 = peg$FAILED
      }

      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 13) {
          s0 = "\r"
          peg$currPos++
        } else {
          s0 = peg$FAILED
        }

        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 8232) {
            s0 = "\u2028"
            peg$currPos++
          } else {
            s0 = peg$FAILED
          }

          if (s0 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 8233) {
              s0 = "\u2029"
              peg$currPos++
            } else {
              s0 = peg$FAILED
            }
          }
        }
      }
    }

    peg$silentFails--
    return s0
  }

  function peg$parseComment() {
    let s0

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    rule$expects(peg$e16)
    peg$silentFails++
    s0 = peg$parseMultiLineComment()

    if (s0 === peg$FAILED) {
      s0 = peg$parseSingleLineComment()
    }

    peg$silentFails--
    return s0
  }

  function peg$parseMultiLineComment() {
    let s0, s1, s2, s3, s4, s5, s6
    s0 = peg$currPos

    if (input.substr(peg$currPos, 2) === peg$c23) {
      s1 = peg$c23
      peg$currPos += 2
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$currPos
      s3 = []
      s4 = peg$currPos
      s5 = peg$currPos
      peg$begin()

      if (input.substr(peg$currPos, 2) === peg$c24) {
        s6 = peg$c24
        peg$currPos += 2
      } else {
        s6 = peg$FAILED
      }

      peg$end(true)

      if (s6 === peg$FAILED) {
        s5 = undefined
      } else {
        peg$currPos = s5
        s5 = peg$FAILED
      }

      if (s5 !== peg$FAILED) {
        s6 = peg$parseSourceCharacter()

        if (s6 !== peg$FAILED) {
          s5 = [s5, s6]
          s4 = s5
        } else {
          peg$currPos = s4
          s4 = peg$FAILED
        }
      } else {
        peg$currPos = s4
        s4 = peg$FAILED
      }

      while (s4 !== peg$FAILED) {
        s3.push(s4)
        s4 = peg$currPos
        s5 = peg$currPos
        peg$begin()

        if (input.substr(peg$currPos, 2) === peg$c24) {
          s6 = peg$c24
          peg$currPos += 2
        } else {
          s6 = peg$FAILED
        }

        peg$end(true)

        if (s6 === peg$FAILED) {
          s5 = undefined
        } else {
          peg$currPos = s5
          s5 = peg$FAILED
        }

        if (s5 !== peg$FAILED) {
          s6 = peg$parseSourceCharacter()

          if (s6 !== peg$FAILED) {
            s5 = [s5, s6]
            s4 = s5
          } else {
            peg$currPos = s4
            s4 = peg$FAILED
          }
        } else {
          peg$currPos = s4
          s4 = peg$FAILED
        }
      }

      s2 = input.substring(s2, peg$currPos)

      if (input.substr(peg$currPos, 2) === peg$c24) {
        s3 = peg$c24
        peg$currPos += 2
      } else {
        s3 = peg$FAILED
      }

      if (s3 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f22(s2)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseMultiLineCommentNoLineTerminator() {
    let s0, s1, s2, s3, s4, s5, s6

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    rule$expects(peg$e17)

    if (input.substr(peg$currPos, 2) === peg$c23) {
      s1 = peg$c23
      peg$currPos += 2
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$currPos
      s3 = []
      s4 = peg$currPos
      s5 = peg$currPos
      peg$begin()
      rule$expects(peg$e18)

      if (input.substr(peg$currPos, 2) === peg$c24) {
        s6 = peg$c24
        peg$currPos += 2
      } else {
        s6 = peg$FAILED
      }

      if (s6 === peg$FAILED) {
        s6 = peg$parseLineTerminator()
      }

      peg$end(true)

      if (s6 === peg$FAILED) {
        s5 = undefined
      } else {
        peg$currPos = s5
        s5 = peg$FAILED
      }

      if (s5 !== peg$FAILED) {
        s6 = peg$parseSourceCharacter()

        if (s6 !== peg$FAILED) {
          s5 = [s5, s6]
          s4 = s5
        } else {
          peg$currPos = s4
          s4 = peg$FAILED
        }
      } else {
        peg$currPos = s4
        s4 = peg$FAILED
      }

      while (s4 !== peg$FAILED) {
        s3.push(s4)
        s4 = peg$currPos
        s5 = peg$currPos
        peg$begin()
        rule$expects(peg$e18)

        if (input.substr(peg$currPos, 2) === peg$c24) {
          s6 = peg$c24
          peg$currPos += 2
        } else {
          s6 = peg$FAILED
        }

        if (s6 === peg$FAILED) {
          s6 = peg$parseLineTerminator()
        }

        peg$end(true)

        if (s6 === peg$FAILED) {
          s5 = undefined
        } else {
          peg$currPos = s5
          s5 = peg$FAILED
        }

        if (s5 !== peg$FAILED) {
          s6 = peg$parseSourceCharacter()

          if (s6 !== peg$FAILED) {
            s5 = [s5, s6]
            s4 = s5
          } else {
            peg$currPos = s4
            s4 = peg$FAILED
          }
        } else {
          peg$currPos = s4
          s4 = peg$FAILED
        }
      }

      s2 = input.substring(s2, peg$currPos)
      rule$expects(peg$e18)

      if (input.substr(peg$currPos, 2) === peg$c24) {
        s3 = peg$c24
        peg$currPos += 2
      } else {
        s3 = peg$FAILED
      }

      if (s3 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f22(s2)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseSingleLineComment() {
    let s0, s1, s2, s3, s4, s5, s6

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    rule$expects(peg$e19)

    if (input.substr(peg$currPos, 2) === peg$c25) {
      s1 = peg$c25
      peg$currPos += 2
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$currPos
      s3 = []
      s4 = peg$currPos
      s5 = peg$currPos
      peg$begin()
      s6 = peg$parseLineTerminator()
      peg$end(true)

      if (s6 === peg$FAILED) {
        s5 = undefined
      } else {
        peg$currPos = s5
        s5 = peg$FAILED
      }

      if (s5 !== peg$FAILED) {
        s6 = peg$parseSourceCharacter()

        if (s6 !== peg$FAILED) {
          s5 = [s5, s6]
          s4 = s5
        } else {
          peg$currPos = s4
          s4 = peg$FAILED
        }
      } else {
        peg$currPos = s4
        s4 = peg$FAILED
      }

      while (s4 !== peg$FAILED) {
        s3.push(s4)
        s4 = peg$currPos
        s5 = peg$currPos
        peg$begin()
        s6 = peg$parseLineTerminator()
        peg$end(true)

        if (s6 === peg$FAILED) {
          s5 = undefined
        } else {
          peg$currPos = s5
          s5 = peg$FAILED
        }

        if (s5 !== peg$FAILED) {
          s6 = peg$parseSourceCharacter()

          if (s6 !== peg$FAILED) {
            s5 = [s5, s6]
            s4 = s5
          } else {
            peg$currPos = s4
            s4 = peg$FAILED
          }
        } else {
          peg$currPos = s4
          s4 = peg$FAILED
        }
      }

      s2 = input.substring(s2, peg$currPos)
      peg$savedPos = s0
      s0 = peg$f23(s2)
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseIdentifier() {
    let s0, s1, s2, s3

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    rule$expects(peg$e20)
    peg$silentFails++
    s0 = peg$currPos
    s1 = peg$parseIdentifierStart()

    if (s1 !== peg$FAILED) {
      s2 = []
      s3 = peg$parseIdentifierPart()

      while (s3 !== peg$FAILED) {
        s2.push(s3)
        s3 = peg$parseIdentifierPart()
      }

      peg$savedPos = s0
      s0 = peg$f24(s1, s2)
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    peg$silentFails--
    return s0
  }

  function peg$parseIdentifierStart() {
    let s0, s1, s2
    s0 = peg$parseUnicodeLetter()

    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 36) {
        s0 = peg$c4
        peg$currPos++
      } else {
        s0 = peg$FAILED
      }

      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 95) {
          s0 = "_"
          peg$currPos++
        } else {
          s0 = peg$FAILED
        }

        if (s0 === peg$FAILED) {
          s0 = peg$currPos

          if (input.charCodeAt(peg$currPos) === 92) {
            s1 = peg$c27
            peg$currPos++
          } else {
            s1 = peg$FAILED
          }

          if (s1 !== peg$FAILED) {
            s2 = peg$parseUnicodeEscapeSequence()

            if (s2 !== peg$FAILED) {
              s0 = s2
            } else {
              peg$currPos = s0
              s0 = peg$FAILED
            }
          } else {
            peg$currPos = s0
            s0 = peg$FAILED
          }
        }
      }
    }

    return s0
  }

  function peg$parseIdentifierPart() {
    let s0 = peg$parseIdentifierStart()

    if (s0 === peg$FAILED) {
      s0 = peg$parseUnicodeCombiningMark()

      if (s0 === peg$FAILED) {
        s0 = peg$parseNd()

        if (s0 === peg$FAILED) {
          s0 = peg$parsePc()

          if (s0 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 8204) {
              s0 = "\u200C"
              peg$currPos++
            } else {
              s0 = peg$FAILED
            }

            if (s0 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 8205) {
                s0 = "\u200D"
                peg$currPos++
              } else {
                s0 = peg$FAILED
              }
            }
          }
        }
      }
    }

    return s0
  }

  function peg$parseUnicodeLetter() {
    let s0 = peg$parseLu()

    if (s0 === peg$FAILED) {
      s0 = peg$parseLl()

      if (s0 === peg$FAILED) {
        s0 = peg$parseLt()

        if (s0 === peg$FAILED) {
          s0 = peg$parseLm()

          if (s0 === peg$FAILED) {
            s0 = peg$parseLo()

            if (s0 === peg$FAILED) {
              s0 = peg$parseNl()
            }
          }
        }
      }
    }

    return s0
  }

  function peg$parseUnicodeCombiningMark() {
    let s0 = peg$parseMn()

    if (s0 === peg$FAILED) {
      s0 = peg$parseMc()
    }

    return s0
  }

  function peg$parseLiteralMatcher() {
    let s0, s1, s2

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    rule$expects(peg$e21)
    peg$silentFails++
    s0 = peg$currPos
    s1 = peg$parseStringLiteral()

    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 105) {
        s2 = peg$c30
        peg$currPos++
      } else {
        s2 = peg$FAILED
      }

      if (s2 === peg$FAILED) {
        s2 = null
      }

      peg$savedPos = s0
      s0 = peg$f25(s1, s2)
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    peg$silentFails--
    return s0
  }

  function peg$parseStringLiteral() {
    let s0, s1, s2, s3

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    rule$expects(peg$e22)
    peg$silentFails++
    s0 = peg$currPos

    if (input.charCodeAt(peg$currPos) === 34) {
      s1 = peg$c31
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = []
      s3 = peg$parseDoubleStringCharacter()

      while (s3 !== peg$FAILED) {
        s2.push(s3)
        s3 = peg$parseDoubleStringCharacter()
      }

      if (input.charCodeAt(peg$currPos) === 34) {
        s3 = peg$c31
        peg$currPos++
      } else {
        s3 = peg$FAILED
      }

      if (s3 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f26(s2)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      s0 = peg$currPos

      if (input.charCodeAt(peg$currPos) === 39) {
        s1 = peg$c32
        peg$currPos++
      } else {
        s1 = peg$FAILED
      }

      if (s1 !== peg$FAILED) {
        s2 = []
        s3 = peg$parseSingleStringCharacter()

        while (s3 !== peg$FAILED) {
          s2.push(s3)
          s3 = peg$parseSingleStringCharacter()
        }

        if (input.charCodeAt(peg$currPos) === 39) {
          s3 = peg$c32
          peg$currPos++
        } else {
          s3 = peg$FAILED
        }

        if (s3 !== peg$FAILED) {
          peg$savedPos = s0
          s0 = peg$f26(s2)
        } else {
          peg$currPos = s0
          s0 = peg$FAILED
        }
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    }

    peg$silentFails--
    return s0
  }

  function peg$parseDoubleStringCharacter() {
    let s0, s1, s2
    s0 = peg$currPos
    s1 = peg$currPos
    peg$begin()

    if (input.charCodeAt(peg$currPos) === 34) {
      s2 = peg$c31
      peg$currPos++
    } else {
      s2 = peg$FAILED
    }

    if (s2 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 92) {
        s2 = peg$c27
        peg$currPos++
      } else {
        s2 = peg$FAILED
      }

      if (s2 === peg$FAILED) {
        s2 = peg$parseLineTerminator()
      }
    }

    peg$end(true)

    if (s2 === peg$FAILED) {
      s1 = undefined
    } else {
      peg$currPos = s1
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$parseSourceCharacter()

      if (s2 !== peg$FAILED) {
        s0 = s2
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      s0 = peg$currPos

      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c27
        peg$currPos++
      } else {
        s1 = peg$FAILED
      }

      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapeSequence()

        if (s2 !== peg$FAILED) {
          s0 = s2
        } else {
          peg$currPos = s0
          s0 = peg$FAILED
        }
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }

      if (s0 === peg$FAILED) {
        s0 = peg$parseLineContinuation()
      }
    }

    return s0
  }

  function peg$parseSingleStringCharacter() {
    let s0, s1, s2
    s0 = peg$currPos
    s1 = peg$currPos
    peg$begin()

    if (input.charCodeAt(peg$currPos) === 39) {
      s2 = peg$c32
      peg$currPos++
    } else {
      s2 = peg$FAILED
    }

    if (s2 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 92) {
        s2 = peg$c27
        peg$currPos++
      } else {
        s2 = peg$FAILED
      }

      if (s2 === peg$FAILED) {
        s2 = peg$parseLineTerminator()
      }
    }

    peg$end(true)

    if (s2 === peg$FAILED) {
      s1 = undefined
    } else {
      peg$currPos = s1
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$parseSourceCharacter()

      if (s2 !== peg$FAILED) {
        s0 = s2
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      s0 = peg$currPos

      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c27
        peg$currPos++
      } else {
        s1 = peg$FAILED
      }

      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapeSequence()

        if (s2 !== peg$FAILED) {
          s0 = s2
        } else {
          peg$currPos = s0
          s0 = peg$FAILED
        }
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }

      if (s0 === peg$FAILED) {
        s0 = peg$parseLineContinuation()
      }
    }

    return s0
  }

  function peg$parseCharacterClassMatcher() {
    let s0, s1, s2, s3, s4, s5

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    rule$expects(peg$e23)
    peg$silentFails++
    s0 = peg$currPos

    if (input.charCodeAt(peg$currPos) === 91) {
      s1 = "["
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 94) {
        s2 = "^"
        peg$currPos++
      } else {
        s2 = peg$FAILED
      }

      if (s2 === peg$FAILED) {
        s2 = null
      }

      s3 = []
      s4 = peg$parseCharacterPart()

      while (s4 !== peg$FAILED) {
        s3.push(s4)
        s4 = peg$parseCharacterPart()
      }

      if (input.charCodeAt(peg$currPos) === 93) {
        s4 = peg$c35
        peg$currPos++
      } else {
        s4 = peg$FAILED
      }

      if (s4 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 105) {
          s5 = peg$c30
          peg$currPos++
        } else {
          s5 = peg$FAILED
        }

        if (s5 === peg$FAILED) {
          s5 = null
        }

        peg$savedPos = s0
        s0 = peg$f27(s2, s3, s5)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    peg$silentFails--
    return s0
  }

  function peg$parseCharacterPart() {
    let s0 = peg$parseClassCharacterRange()

    if (s0 === peg$FAILED) {
      s0 = peg$parseClassCharacter()
    }

    return s0
  }

  function peg$parseClassCharacterRange() {
    let s0, s1, s2, s3
    s0 = peg$currPos
    s1 = peg$parseClassCharacter()

    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 45) {
        s2 = "-"
        peg$currPos++
      } else {
        s2 = peg$FAILED
      }

      if (s2 !== peg$FAILED) {
        s3 = peg$parseClassCharacter()

        if (s3 !== peg$FAILED) {
          peg$savedPos = s0
          s0 = peg$f28(s1, s3)
        } else {
          peg$currPos = s0
          s0 = peg$FAILED
        }
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseClassCharacter() {
    let s0, s1, s2
    s0 = peg$currPos
    s1 = peg$currPos
    peg$begin()

    if (input.charCodeAt(peg$currPos) === 93) {
      s2 = peg$c35
      peg$currPos++
    } else {
      s2 = peg$FAILED
    }

    if (s2 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 92) {
        s2 = peg$c27
        peg$currPos++
      } else {
        s2 = peg$FAILED
      }

      if (s2 === peg$FAILED) {
        s2 = peg$parseLineTerminator()
      }
    }

    peg$end(true)

    if (s2 === peg$FAILED) {
      s1 = undefined
    } else {
      peg$currPos = s1
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$parseSourceCharacter()

      if (s2 !== peg$FAILED) {
        s0 = s2
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      s0 = peg$currPos

      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c27
        peg$currPos++
      } else {
        s1 = peg$FAILED
      }

      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapeSequence()

        if (s2 !== peg$FAILED) {
          s0 = s2
        } else {
          peg$currPos = s0
          s0 = peg$FAILED
        }
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }

      if (s0 === peg$FAILED) {
        s0 = peg$parseLineContinuation()
      }
    }

    return s0
  }

  function peg$parseLineContinuation() {
    let s0, s1, s2
    s0 = peg$currPos

    if (input.charCodeAt(peg$currPos) === 92) {
      s1 = peg$c27
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$parseLineTerminatorSequence()

      if (s2 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f29()
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseEscapeSequence() {
    let s0, s1, s2, s3
    s0 = peg$parseCharacterEscapeSequence()

    if (s0 === peg$FAILED) {
      s0 = peg$currPos

      if (input.charCodeAt(peg$currPos) === 48) {
        s1 = "0"
        peg$currPos++
      } else {
        s1 = peg$FAILED
      }

      if (s1 !== peg$FAILED) {
        s2 = peg$currPos
        peg$begin()
        s3 = peg$parseDecimalDigit()
        peg$end(true)

        if (s3 === peg$FAILED) {
          s2 = undefined
        } else {
          peg$currPos = s2
          s2 = peg$FAILED
        }

        if (s2 !== peg$FAILED) {
          peg$savedPos = s0
          s0 = peg$f30()
        } else {
          peg$currPos = s0
          s0 = peg$FAILED
        }
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }

      if (s0 === peg$FAILED) {
        s0 = peg$parseHexEscapeSequence()

        if (s0 === peg$FAILED) {
          s0 = peg$parseUnicodeEscapeSequence()
        }
      }
    }

    return s0
  }

  function peg$parseCharacterEscapeSequence() {
    let s0 = peg$parseSingleEscapeCharacter()

    if (s0 === peg$FAILED) {
      s0 = peg$parseNonEscapeCharacter()
    }

    return s0
  }

  function peg$parseSingleEscapeCharacter() {
    let s0, s1

    if (input.charCodeAt(peg$currPos) === 39) {
      s0 = peg$c32
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 34) {
        s0 = peg$c31
        peg$currPos++
      } else {
        s0 = peg$FAILED
      }

      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 92) {
          s0 = peg$c27
          peg$currPos++
        } else {
          s0 = peg$FAILED
        }

        if (s0 === peg$FAILED) {
          s0 = peg$currPos

          if (input.charCodeAt(peg$currPos) === 98) {
            s1 = "b"
            peg$currPos++
          } else {
            s1 = peg$FAILED
          }

          if (s1 !== peg$FAILED) {
            peg$savedPos = s0
            s1 = peg$f31()
          }

          s0 = s1

          if (s0 === peg$FAILED) {
            s0 = peg$currPos

            if (input.charCodeAt(peg$currPos) === 102) {
              s1 = "f"
              peg$currPos++
            } else {
              s1 = peg$FAILED
            }

            if (s1 !== peg$FAILED) {
              peg$savedPos = s0
              s1 = peg$f32()
            }

            s0 = s1

            if (s0 === peg$FAILED) {
              s0 = peg$currPos

              if (input.charCodeAt(peg$currPos) === 110) {
                s1 = "n"
                peg$currPos++
              } else {
                s1 = peg$FAILED
              }

              if (s1 !== peg$FAILED) {
                peg$savedPos = s0
                s1 = peg$f33()
              }

              s0 = s1

              if (s0 === peg$FAILED) {
                s0 = peg$currPos

                if (input.charCodeAt(peg$currPos) === 114) {
                  s1 = "r"
                  peg$currPos++
                } else {
                  s1 = peg$FAILED
                }

                if (s1 !== peg$FAILED) {
                  peg$savedPos = s0
                  s1 = peg$f34()
                }

                s0 = s1

                if (s0 === peg$FAILED) {
                  s0 = peg$currPos

                  if (input.charCodeAt(peg$currPos) === 116) {
                    s1 = "t"
                    peg$currPos++
                  } else {
                    s1 = peg$FAILED
                  }

                  if (s1 !== peg$FAILED) {
                    peg$savedPos = s0
                    s1 = peg$f35()
                  }

                  s0 = s1

                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos

                    if (input.charCodeAt(peg$currPos) === 118) {
                      s1 = "v"
                      peg$currPos++
                    } else {
                      s1 = peg$FAILED
                    }

                    if (s1 !== peg$FAILED) {
                      peg$savedPos = s0
                      s1 = peg$f36()
                    }

                    s0 = s1
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0
  }

  function peg$parseNonEscapeCharacter() {
    let s0, s1, s2
    s0 = peg$currPos
    s1 = peg$currPos
    peg$begin()
    s2 = peg$parseEscapeCharacter()

    if (s2 === peg$FAILED) {
      s2 = peg$parseLineTerminator()
    }

    peg$end(true)

    if (s2 === peg$FAILED) {
      s1 = undefined
    } else {
      peg$currPos = s1
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$parseSourceCharacter()

      if (s2 !== peg$FAILED) {
        s0 = s2
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseEscapeCharacter() {
    let s0 = peg$parseSingleEscapeCharacter()

    if (s0 === peg$FAILED) {
      s0 = peg$parseDecimalDigit()

      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 120) {
          s0 = peg$c44
          peg$currPos++
        } else {
          s0 = peg$FAILED
        }

        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 117) {
            s0 = peg$c45
            peg$currPos++
          } else {
            s0 = peg$FAILED
          }
        }
      }
    }

    return s0
  }

  function peg$parseHexEscapeSequence() {
    let s0, s1, s2, s3, s4, s5
    s0 = peg$currPos

    if (input.charCodeAt(peg$currPos) === 120) {
      s1 = peg$c44
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$currPos
      s3 = peg$currPos
      s4 = peg$parseHexDigit()

      if (s4 !== peg$FAILED) {
        s5 = peg$parseHexDigit()

        if (s5 !== peg$FAILED) {
          s4 = [s4, s5]
          s3 = s4
        } else {
          peg$currPos = s3
          s3 = peg$FAILED
        }
      } else {
        peg$currPos = s3
        s3 = peg$FAILED
      }

      if (s3 !== peg$FAILED) {
        s2 = input.substring(s2, peg$currPos)
      } else {
        s2 = s3
      }

      if (s2 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f37(s2)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseUnicodeEscapeSequence() {
    let s0, s1, s2, s3, s4, s5, s6, s7
    s0 = peg$currPos

    if (input.charCodeAt(peg$currPos) === 117) {
      s1 = peg$c45
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$currPos
      s3 = peg$currPos
      s4 = peg$parseHexDigit()

      if (s4 !== peg$FAILED) {
        s5 = peg$parseHexDigit()

        if (s5 !== peg$FAILED) {
          s6 = peg$parseHexDigit()

          if (s6 !== peg$FAILED) {
            s7 = peg$parseHexDigit()

            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7]
              s3 = s4
            } else {
              peg$currPos = s3
              s3 = peg$FAILED
            }
          } else {
            peg$currPos = s3
            s3 = peg$FAILED
          }
        } else {
          peg$currPos = s3
          s3 = peg$FAILED
        }
      } else {
        peg$currPos = s3
        s3 = peg$FAILED
      }

      if (s3 !== peg$FAILED) {
        s2 = input.substring(s2, peg$currPos)
      } else {
        s2 = s3
      }

      if (s2 !== peg$FAILED) {
        peg$savedPos = s0
        s0 = peg$f37(s2)
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseDecimalDigit() {
    let s0

    if (/^[0-9]/.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseHexDigit() {
    let s0

    if (/^[0-9a-f]/i.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseAnyMatcher() {
    let s0, s1

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    rule$expects(peg$e24)

    if (input.charCodeAt(peg$currPos) === 46) {
      s1 = "."
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      peg$savedPos = s0
      s1 = peg$f38()
    }

    s0 = s1
    return s0
  }

  function peg$parseCodeBlock() {
    let s0, s1, s2, s3

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    rule$expects(peg$e25)
    peg$silentFails++
    s0 = peg$currPos

    if (input.charCodeAt(peg$currPos) === 123) {
      s1 = peg$c47
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    if (s1 !== peg$FAILED) {
      s2 = peg$parseCode()

      if (input.charCodeAt(peg$currPos) === 125) {
        s3 = peg$c48
        peg$currPos++
      } else {
        s3 = peg$FAILED
      }

      if (s3 !== peg$FAILED) {
        s0 = s2
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      s0 = peg$currPos

      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c47
        peg$currPos++
      } else {
        s1 = peg$FAILED
      }

      if (s1 !== peg$FAILED) {
        peg$savedPos = s0
        s1 = peg$f39()
      }

      s0 = s1
    }

    peg$silentFails--
    return s0
  }

  function peg$parseCode() {
    let s0, s1, s2, s3, s4, s5
    s0 = peg$currPos
    s1 = []
    s2 = []
    s3 = peg$currPos
    s4 = peg$currPos
    peg$begin()

    if (peg$r3.test(input.charAt(peg$currPos))) {
      s5 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s5 = peg$FAILED
    }

    peg$end(true)

    if (s5 === peg$FAILED) {
      s4 = undefined
    } else {
      peg$currPos = s4
      s4 = peg$FAILED
    }

    if (s4 !== peg$FAILED) {
      s5 = peg$parseSourceCharacter()

      if (s5 !== peg$FAILED) {
        s4 = [s4, s5]
        s3 = s4
      } else {
        peg$currPos = s3
        s3 = peg$FAILED
      }
    } else {
      peg$currPos = s3
      s3 = peg$FAILED
    }

    if (s3 !== peg$FAILED) {
      while (s3 !== peg$FAILED) {
        s2.push(s3)
        s3 = peg$currPos
        s4 = peg$currPos
        peg$begin()

        if (peg$r3.test(input.charAt(peg$currPos))) {
          s5 = input.charAt(peg$currPos)
          peg$currPos++
        } else {
          s5 = peg$FAILED
        }

        peg$end(true)

        if (s5 === peg$FAILED) {
          s4 = undefined
        } else {
          peg$currPos = s4
          s4 = peg$FAILED
        }

        if (s4 !== peg$FAILED) {
          s5 = peg$parseSourceCharacter()

          if (s5 !== peg$FAILED) {
            s4 = [s4, s5]
            s3 = s4
          } else {
            peg$currPos = s3
            s3 = peg$FAILED
          }
        } else {
          peg$currPos = s3
          s3 = peg$FAILED
        }
      }
    } else {
      s2 = peg$FAILED
    }

    if (s2 === peg$FAILED) {
      s2 = peg$currPos

      if (input.charCodeAt(peg$currPos) === 123) {
        s3 = peg$c47
        peg$currPos++
      } else {
        s3 = peg$FAILED
      }

      if (s3 !== peg$FAILED) {
        s4 = peg$parseCode()

        if (input.charCodeAt(peg$currPos) === 125) {
          s5 = peg$c48
          peg$currPos++
        } else {
          s5 = peg$FAILED
        }

        if (s5 !== peg$FAILED) {
          s3 = [s3, s4, s5]
          s2 = s3
        } else {
          peg$currPos = s2
          s2 = peg$FAILED
        }
      } else {
        peg$currPos = s2
        s2 = peg$FAILED
      }
    }

    while (s2 !== peg$FAILED) {
      s1.push(s2)
      s2 = []
      s3 = peg$currPos
      s4 = peg$currPos
      peg$begin()

      if (peg$r3.test(input.charAt(peg$currPos))) {
        s5 = input.charAt(peg$currPos)
        peg$currPos++
      } else {
        s5 = peg$FAILED
      }

      peg$end(true)

      if (s5 === peg$FAILED) {
        s4 = undefined
      } else {
        peg$currPos = s4
        s4 = peg$FAILED
      }

      if (s4 !== peg$FAILED) {
        s5 = peg$parseSourceCharacter()

        if (s5 !== peg$FAILED) {
          s4 = [s4, s5]
          s3 = s4
        } else {
          peg$currPos = s3
          s3 = peg$FAILED
        }
      } else {
        peg$currPos = s3
        s3 = peg$FAILED
      }

      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3)
          s3 = peg$currPos
          s4 = peg$currPos
          peg$begin()

          if (peg$r3.test(input.charAt(peg$currPos))) {
            s5 = input.charAt(peg$currPos)
            peg$currPos++
          } else {
            s5 = peg$FAILED
          }

          peg$end(true)

          if (s5 === peg$FAILED) {
            s4 = undefined
          } else {
            peg$currPos = s4
            s4 = peg$FAILED
          }

          if (s4 !== peg$FAILED) {
            s5 = peg$parseSourceCharacter()

            if (s5 !== peg$FAILED) {
              s4 = [s4, s5]
              s3 = s4
            } else {
              peg$currPos = s3
              s3 = peg$FAILED
            }
          } else {
            peg$currPos = s3
            s3 = peg$FAILED
          }
        }
      } else {
        s2 = peg$FAILED
      }

      if (s2 === peg$FAILED) {
        s2 = peg$currPos

        if (input.charCodeAt(peg$currPos) === 123) {
          s3 = peg$c47
          peg$currPos++
        } else {
          s3 = peg$FAILED
        }

        if (s3 !== peg$FAILED) {
          s4 = peg$parseCode()

          if (input.charCodeAt(peg$currPos) === 125) {
            s5 = peg$c48
            peg$currPos++
          } else {
            s5 = peg$FAILED
          }

          if (s5 !== peg$FAILED) {
            s3 = [s3, s4, s5]
            s2 = s3
          } else {
            peg$currPos = s2
            s2 = peg$FAILED
          }
        } else {
          peg$currPos = s2
          s2 = peg$FAILED
        }
      }
    }

    s0 = input.substring(s0, peg$currPos)
    return s0
  }

  function peg$parseLl() {
    let s0

    if (
      /^[a-z\xB5\xDF-\xF6\xF8-\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137-\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148-\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C-\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA-\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9-\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC-\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF-\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F-\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02AF\u0371\u0373\u0377\u037B-\u037D\u0390\u03AC-\u03CE\u03D0-\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB-\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE-\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0529\u052B\u052D\u052F\u0560-\u0588\u10D0-\u10FA\u10FD-\u10FF\u13F8-\u13FD\u1C80-\u1C88\u1D00-\u1D2B\u1D6B-\u1D77\u1D79-\u1D9A\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6-\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FC7\u1FD0-\u1FD3\u1FD6-\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6-\u1FF7\u210A\u210E-\u210F\u2113\u212F\u2134\u2139\u213C-\u213D\u2146-\u2149\u214E\u2184\u2C30-\u2C5E\u2C61\u2C65-\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73-\u2C74\u2C76-\u2C7B\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3-\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA699\uA69B\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F\uA771-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793-\uA795\uA797\uA799\uA79B\uA79D\uA79F\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7AF\uA7B5\uA7B7\uA7B9\uA7FA\uAB30-\uAB5A\uAB60-\uAB65\uAB70-\uABBF\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A]/.test(
        input.charAt(peg$currPos)
      )
    ) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseLm() {
    let s0

    if (
      /^[\u02B0-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0374\u037A\u0559\u0640\u06E5-\u06E6\u07F4-\u07F5\u07FA\u081A\u0824\u0828\u0971\u0E46\u0EC6\u10FC\u17D7\u1843\u1AA7\u1C78-\u1C7D\u1D2C-\u1D6A\u1D78\u1D9B-\u1DBF\u2071\u207F\u2090-\u209C\u2C7C-\u2C7D\u2D6F\u2E2F\u3005\u3031-\u3035\u303B\u309D-\u309E\u30FC-\u30FE\uA015\uA4F8-\uA4FD\uA60C\uA67F\uA69C-\uA69D\uA717-\uA71F\uA770\uA788\uA7F8-\uA7F9\uA9CF\uA9E6\uAA70\uAADD\uAAF3-\uAAF4\uAB5C-\uAB5F\uFF70\uFF9E-\uFF9F]/.test(
        input.charAt(peg$currPos)
      )
    ) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseLo() {
    let s0

    if (
      /^[\xAA\xBA\u01BB\u01C0-\u01C3\u0294\u05D0-\u05EA\u05EF-\u05F2\u0620-\u063F\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06D5\u06EE-\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u0800-\u0815\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0972-\u0980\u0985-\u098C\u098F-\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC-\u09DD\u09DF-\u09E1\u09F0-\u09F1\u09FC\u0A05-\u0A0A\u0A0F-\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32-\u0A33\u0A35-\u0A36\u0A38-\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2-\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0-\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F-\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32-\u0B33\u0B35-\u0B39\u0B3D\u0B5C-\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99-\u0B9A\u0B9C\u0B9E-\u0B9F\u0BA3-\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60-\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0-\u0CE1\u0CF1-\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32-\u0E33\u0E40-\u0E45\u0E81-\u0E82\u0E84\u0E87-\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA-\u0EAB\u0EAD-\u0EB0\u0EB2-\u0EB3\u0EBD\u0EC0-\u0EC4\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065-\u1066\u106E-\u1070\u1075-\u1081\u108E\u1100-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17DC\u1820-\u1842\u1844-\u1878\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE-\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C77\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5-\u1CF6\u2135-\u2138\u2D30-\u2D67\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3006\u303C\u3041-\u3096\u309F\u30A1-\u30FA\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEF\uA000-\uA014\uA016-\uA48C\uA4D0-\uA4F7\uA500-\uA60B\uA610-\uA61F\uA62A-\uA62B\uA66E\uA6A0-\uA6E5\uA78F\uA7F7\uA7FB-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD-\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9E0-\uA9E4\uA9E7-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA6F\uAA71-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5-\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADC\uAAE0-\uAAEA\uAAF2\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40-\uFB41\uFB43-\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF66-\uFF6F\uFF71-\uFF9D\uFFA0-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/.test(
        input.charAt(peg$currPos)
      )
    ) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseLt() {
    let s0

    if (
      /^[\u01C5\u01C8\u01CB\u01F2\u1F88-\u1F8F\u1F98-\u1F9F\u1FA8-\u1FAF\u1FBC\u1FCC\u1FFC]/.test(
        input.charAt(peg$currPos)
      )
    ) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseLu() {
    let s0

    if (
      /^[A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178-\u0179\u017B\u017D\u0181-\u0182\u0184\u0186-\u0187\u0189-\u018B\u018E-\u0191\u0193-\u0194\u0196-\u0198\u019C-\u019D\u019F-\u01A0\u01A2\u01A4\u01A6-\u01A7\u01A9\u01AC\u01AE-\u01AF\u01B1-\u01B3\u01B5\u01B7-\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A-\u023B\u023D-\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u037F\u0386\u0388-\u038A\u038C\u038E-\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9-\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0-\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0528\u052A\u052C\u052E\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u13A0-\u13F5\u1C90-\u1CBA\u1CBD-\u1CBF\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E-\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA698\uA69A\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D-\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA796\uA798\uA79A\uA79C\uA79E\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA-\uA7AE\uA7B0-\uA7B4\uA7B6\uA7B8\uFF21-\uFF3A]/.test(
        input.charAt(peg$currPos)
      )
    ) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseMc() {
    let s0

    if (
      /^[\u0903\u093B\u093E-\u0940\u0949-\u094C\u094E-\u094F\u0982-\u0983\u09BE-\u09C0\u09C7-\u09C8\u09CB-\u09CC\u09D7\u0A03\u0A3E-\u0A40\u0A83\u0ABE-\u0AC0\u0AC9\u0ACB-\u0ACC\u0B02-\u0B03\u0B3E\u0B40\u0B47-\u0B48\u0B4B-\u0B4C\u0B57\u0BBE-\u0BBF\u0BC1-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCC\u0BD7\u0C01-\u0C03\u0C41-\u0C44\u0C82-\u0C83\u0CBE\u0CC0-\u0CC4\u0CC7-\u0CC8\u0CCA-\u0CCB\u0CD5-\u0CD6\u0D02-\u0D03\u0D3E-\u0D40\u0D46-\u0D48\u0D4A-\u0D4C\u0D57\u0D82-\u0D83\u0DCF-\u0DD1\u0DD8-\u0DDF\u0DF2-\u0DF3\u0F3E-\u0F3F\u0F7F\u102B-\u102C\u1031\u1038\u103B-\u103C\u1056-\u1057\u1062-\u1064\u1067-\u106D\u1083-\u1084\u1087-\u108C\u108F\u109A-\u109C\u17B6\u17BE-\u17C5\u17C7-\u17C8\u1923-\u1926\u1929-\u192B\u1930-\u1931\u1933-\u1938\u1A19-\u1A1A\u1A55\u1A57\u1A61\u1A63-\u1A64\u1A6D-\u1A72\u1B04\u1B35\u1B3B\u1B3D-\u1B41\u1B43-\u1B44\u1B82\u1BA1\u1BA6-\u1BA7\u1BAA\u1BE7\u1BEA-\u1BEC\u1BEE\u1BF2-\u1BF3\u1C24-\u1C2B\u1C34-\u1C35\u1CE1\u1CF2-\u1CF3\u1CF7\u302E-\u302F\uA823-\uA824\uA827\uA880-\uA881\uA8B4-\uA8C3\uA952-\uA953\uA983\uA9B4-\uA9B5\uA9BA-\uA9BB\uA9BD-\uA9C0\uAA2F-\uAA30\uAA33-\uAA34\uAA4D\uAA7B\uAA7D\uAAEB\uAAEE-\uAAEF\uAAF5\uABE3-\uABE4\uABE6-\uABE7\uABE9-\uABEA\uABEC]/.test(
        input.charAt(peg$currPos)
      )
    ) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseMn() {
    let s0

    if (
      /^[\u0300-\u036F\u0483-\u0487\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962-\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2-\u09E3\u09FE\u0A01-\u0A02\u0A3C\u0A41-\u0A42\u0A47-\u0A48\u0A4B-\u0A4D\u0A51\u0A70-\u0A71\u0A75\u0A81-\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7-\u0AC8\u0ACD\u0AE2-\u0AE3\u0AFA-\u0AFF\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B56\u0B62-\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C04\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55-\u0C56\u0C62-\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CCC-\u0CCD\u0CE2-\u0CE3\u0D00-\u0D01\u0D3B-\u0D3C\u0D41-\u0D44\u0D4D\u0D62-\u0D63\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB-\u0EBC\u0EC8-\u0ECD\u0F18-\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86-\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039-\u103A\u103D-\u103E\u1058-\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085-\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752-\u1753\u1772-\u1773\u17B4-\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u1885-\u1886\u18A9\u1920-\u1922\u1927-\u1928\u1932\u1939-\u193B\u1A17-\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ABD\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80-\u1B81\u1BA2-\u1BA5\u1BA8-\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8-\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099-\u309A\uA66F\uA674-\uA67D\uA69E-\uA69F\uA6F0-\uA6F1\uA802\uA806\uA80B\uA825-\uA826\uA8C4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9E5\uAA29-\uAA2E\uAA31-\uAA32\uAA35-\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7-\uAAB8\uAABE-\uAABF\uAAC1\uAAEC-\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/.test(
        input.charAt(peg$currPos)
      )
    ) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseNd() {
    let s0

    if (
      /^[0-9\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F29\u1040-\u1049\u1090-\u1099\u17E0-\u17E9\u1810-\u1819\u1946-\u194F\u19D0-\u19D9\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\uA620-\uA629\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19]/.test(
        input.charAt(peg$currPos)
      )
    ) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseNl() {
    let s0

    if (
      /^[\u16EE-\u16F0\u2160-\u2182\u2185-\u2188\u3007\u3021-\u3029\u3038-\u303A\uA6E6-\uA6EF]/.test(
        input.charAt(peg$currPos)
      )
    ) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parsePc() {
    let s0

    if (
      /^[_\u203F-\u2040\u2054\uFE33-\uFE34\uFE4D-\uFE4F\uFF3F]/.test(
        input.charAt(peg$currPos)
      )
    ) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parseZs() {
    let s0

    if (/^[ \xA0\u1680\u2000-\u200A\u202F\u205F\u3000]/.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s0 = peg$FAILED
    }

    return s0
  }

  function peg$parse__() {
    let s0, s1
    s0 = []
    s1 = peg$parseWhiteSpace()

    if (s1 === peg$FAILED) {
      s1 = peg$parseLineTerminatorSequence()

      if (s1 === peg$FAILED) {
        s1 = peg$parseComment()
      }
    }

    while (s1 !== peg$FAILED) {
      s0.push(s1)
      s1 = peg$parseWhiteSpace()

      if (s1 === peg$FAILED) {
        s1 = peg$parseLineTerminatorSequence()

        if (s1 === peg$FAILED) {
          s1 = peg$parseComment()
        }
      }
    }

    return s0
  }

  function peg$parse_() {
    let s0, s1
    s0 = []
    s1 = peg$parseWhiteSpace()

    if (s1 === peg$FAILED) {
      s1 = peg$parseMultiLineCommentNoLineTerminator()
    }

    while (s1 !== peg$FAILED) {
      s0.push(s1)
      s1 = peg$parseWhiteSpace()

      if (s1 === peg$FAILED) {
        s1 = peg$parseMultiLineCommentNoLineTerminator()
      }
    }

    return s0
  }

  function peg$parseEOS() {
    let s0, s1, s2, s3

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    s1 = peg$parse__()
    rule$expects(peg$e26)

    if (input.charCodeAt(peg$currPos) === 59) {
      s2 = ";"
      peg$currPos++
    } else {
      s2 = peg$FAILED
    }

    if (s2 !== peg$FAILED) {
      s1 = [s1, s2]
      s0 = s1
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    if (s0 === peg$FAILED) {
      s0 = peg$currPos
      s1 = peg$parse_()
      s2 = peg$parseSingleLineComment()

      if (s2 === peg$FAILED) {
        s2 = null
      }

      s3 = peg$parseLineTerminatorSequence()

      if (s3 !== peg$FAILED) {
        s1 = [s1, s2, s3]
        s0 = s1
      } else {
        peg$currPos = s0
        s0 = peg$FAILED
      }

      if (s0 === peg$FAILED) {
        s0 = peg$currPos
        s1 = peg$parse__()
        s2 = peg$parseEOF()

        if (s2 !== peg$FAILED) {
          s1 = [s1, s2]
          s0 = s1
        } else {
          peg$currPos = s0
          s0 = peg$FAILED
        }
      }
    }

    return s0
  }

  function peg$parseEOF() {
    let s0, s1

    let rule$expects = expected => {
      if (peg$silentFails === 0) {
        peg$expect(expected)
      }
    }

    s0 = peg$currPos
    peg$begin()
    rule$expects(peg$e12)

    if (input.length > peg$currPos) {
      s1 = input.charAt(peg$currPos)
      peg$currPos++
    } else {
      s1 = peg$FAILED
    }

    peg$end(true)

    if (s1 === peg$FAILED) {
      s0 = undefined
    } else {
      peg$currPos = s0
      s0 = peg$FAILED
    }

    return s0
  }

  let pick = true
  const RESERVED_WORDS = new Set()
  const reservedWords$1 = options.reservedWords || reservedWords

  if (Array.isArray(reservedWords$1)) {
    reservedWords$1.forEach(word => {
      RESERVED_WORDS.add(word)
    })
  }

  function createNode(type, details) {
    const node = new Node(type, location())
    if (details === null) return node
    Object.assign(node, details)
    return node
  }

  const comments = options.extractComments ? {} : null

  function addComment(text, multiline) {
    const loc = location()

    if (options.extractComments) {
      comments[loc.start.offset] = {
        text,
        multiline,
        location: loc,
      }
    }

    return text
  }

  peg$begin()
  peg$result = peg$startRuleFunction()

  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$expect(peg$endExpectation$1())
    }

    throw peg$buildError()
  }
}
var parser = {
  SyntaxError: peg$SyntaxError$1,
  parse: peg$parse,
}

var parser$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  SyntaxError: peg$SyntaxError$1,
  parse: peg$parse,
  default: parser,
})

function fatal(message, location) {
  if (location != null) {
    throw new GrammarError(message, location)
  }

  throw new Error(message)
}

class Session {
  constructor(config = {}) {
    var _config$opcodes, _config$parser, _config$passes, _config$visitor, _config$vm

    this.fatal = fatal
    this.opcodes = (_config$opcodes = config.opcodes) != null ? _config$opcodes : opcodes
    this.parser = (_config$parser = config.parser) != null ? _config$parser : parser$1
    this.passes = (_config$passes = config.passes) != null ? _config$passes : {}
    this.visitor = (_config$visitor = config.visitor) != null ? _config$visitor : visitor
    this.vm =
      (_config$vm = config.vm) != null
        ? _config$vm
        : {
            evalModule,
          }
    if (lodash.isFunction(config.warn)) this.warn = config.warn
    if (lodash.isFunction(config.error)) this.error = config.error
  }

  parse(input, options) {
    return this.parser.parse(input, options)
  }

  buildVisitor(functions) {
    return this.visitor.build(functions)
  }

  warn() {}

  error(message, location) {
    fatal(message, location)
  }
}

const passes = {
  check: {
    reportUndefinedRules,
    reportDuplicateRules,
    reportUnusedRules,
    reportDuplicateLabels,
    reportInfiniteRecursion,
    reportInfiniteRepetition,
    reportIncorrectPlucking,
  },
  transform: {
    removeProxyRules,
  },
  generate: {
    calcReportFailures,
    inferenceMatchResult,
    generateBytecode,
    generateJS,
  },
}
function compile(ast, session, options = {}) {
  options = {
    allowedStartRules: [ast.rules[0].name],
    cache: false,
    context: {},
    dependencies: {},
    format: "commonjs",
    optimize: "speed",
    output: "parser",
    helpers: `${name}/runtime`,
    trace: false,
    prettier: false,
    ...options,
  }

  if (options.output === "parser") {
    options.format = "commonjs"
  }

  lodash.forEach(session.passes, stage => {
    stage.forEach(pass => {
      pass(ast, session, options)
    })
  })
  let code = ast.code

  switch (options.output) {
    case "parser": {
      const js = code
      return session.vm.evalModule(js, options.context)
    }

    case "source": {
      if (options.prettier) {
        const prettier = require("prettier")

        code = prettier.format(code, {
          parser: "babel",
          arrowParens: "avoid",
        })
      }

      return code
    }

    default:
      session.error(`Invalid output format: ${options.output}.`)
  }
}

var mod$2 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  passes: passes,
  compile: compile,
  get opcodes() {
    return opcodes
  },
  Session: Session,
})

function generate(grammar, options = {}) {
  var _options$parser

  const session = new Session({
    passes: convertPasses(passes),
  })

  if (Array.isArray(options.plugins)) {
    options.plugins.forEach(p => {
      const use = "use" in p ? p.use : p
      if (!lodash.isFunction(use)) return
      use.call(p, session, options)
    })
  }

  return compile(
    session.parse(
      grammar,
      (_options$parser = options.parser) != null ? _options$parser : {}
    ),
    session,
    options
  )
}

exports.GrammarError = GrammarError
exports.VERSION = version
exports.ast = mod$1
exports.compiler = mod$2
exports.generate = generate
exports.parser = parser
exports.util = mod
