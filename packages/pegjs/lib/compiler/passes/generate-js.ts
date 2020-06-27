/* eslint no-mixed-operators: 0, prefer-const: 0 */
import { map, isString, isEmpty } from "lodash"
import type { Grammar } from "../../ast/Grammar"
import type { Session } from "../session"
import type { ICompilerPassOptions } from "../mod"
import { regexpEscape } from "../../util/mod"
import { version as VERSION } from "@pegjs/main/package.json"
import jsesc from "jsesc"
import { Rule } from "../../ast/Node"

import {
  peg$SyntaxError,
  peg$buildSimpleError,
  peg$buildStructuredError,
} from "@pegjs/main/runtime/SyntaxError"
import { peg$DefaultTracer } from "@pegjs/main/runtime/DefaultTracer"
import {
  peg$literalExpectation,
  peg$classExpectation,
  peg$anyExpectation,
  peg$endExpectation,
  peg$otherExpectation,
} from "@pegjs/main/runtime/expectation"

type StringGenerator = Generator<string | undefined, void, undefined>

function assertString(value: any): string {
  if (process.env.NODE_ENV !== "production" && !isString(value)) {
    throw TypeError(`Expected string, got ${typeof value}`)
  }
  return value
}

function join(generator: StringGenerator) {
  return Array.from(generator, s => assertString(s || "")).join("\n")
}

const l = (i: number) => `peg$c${i}` // |literals[i]| of the abstract machine
const r = (i: number) => `peg$r${i}` // |classes[i]| of the abstract machine
const e = (i: number) => `peg$e${i}` // |expectations[i]| of the abstract machine
const f = (i: number) => `peg$f${i}` // |actions[i]| of the abstract machine

function buildLiteral(literal: string) {
  return "'" + jsesc(literal) + "'"
}

// Generates parser JavaScript code.
export function generateJS(
  ast: Grammar,
  session: Session,
  options: ICompilerPassOptions
) {
  const op = session.opcodes

  /* Features that should be generated in the parser. */
  const features = options.features || {}
  function use(feature: string) {
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

        // istanbul ignore next
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
            .map(rule => rule.bytecode!)
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

  function* generateRuleHeader(
    ruleNameCode: string,
    ruleIndexCode: string | number
  ): StringGenerator {
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
      /**
          ].join("\n")
        )
      */

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

  function* generateRuleFooter(ruleNameCode, resultCode): StringGenerator {
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

  function* generateInterpreter(): StringGenerator {
    function generateCondition(condition: string, argsLength: number) {
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

    function generateLoop(condition: string) {
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
    }

    function generateCall() {
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

    // The point of the outer loop and the |ips| & |ends| stacks is to avoid
    // recursive calls for interpreting parts of bytecode. In other words, we
    // implement the |interpret| operation of the abstract machine without
    // function calls. Such calls would likely slow the parser down and more
    // importantly cause stack overflows for complex grammars.

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
                ${generateLoop("stack[stack.length - 1] !== peg$FAILED")}
      
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
                ${generateCall()}
      
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

  function* generateRuleFunction(rule: Rule): StringGenerator {
    const stackVars: string[] = []

    function s(i: number) {
      // istanbul ignore next
      if (i < 0) {
        session.fatal(
          `Rule '${rule.name}': Var stack underflow: attempt to use var at index ${i}`
        )
      }
      return `s${i}`
    } // |stack[i]| of the abstract machine

    const stack = {
      sp: -1,
      maxSp: -1,

      push(exprCode: string) {
        const code = `${s(++this.sp)} = ${exprCode};`
        if (this.sp > this.maxSp) this.maxSp = this.sp
        return code
      },

      pop() {
        return s(this.sp--)
      },

      pop2(n: number) {
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

      index(i: number) {
        return s(this.sp - i)
      },
    }

    function* compile(bc: number[]) {
      let ip = 0
      const end = bc.length

      function* compileCondition(condition: string, argCount: number): StringGenerator {
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

          // istanbul ignore if
          if (thenSp !== elseSp) {
            session.fatal(
              `Rule '${rule.name}', position ${pos}: Branches of a condition can't move the stack pointer differently (before: ${baseSp}, after then: ${thenSp}, after else: ${elseSp}).`
            )
          }
        }
        yield "}"
      }

      function* compileLoop(condition: string) {
        const pos = ip
        const baseLength = 2
        const bodyLength = bc[ip + baseLength - 1]
        const baseSp = stack.sp
        yield `while (${condition}) {`

        ip += baseLength
        yield* compile(bc.slice(ip, ip + bodyLength))
        const bodySp = stack.sp
        ip += bodyLength

        // istanbul ignore if
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
        let value: string
        switch (bc[ip]) {
          case op.PUSH_EMPTY_STRING: // PUSH_EMPTY_STRING
            yield stack.push("''")
            ip++
            break

          case op.PUSH_CURR_POS: // PUSH_CURR_POS
            yield stack.push("peg$currPos")
            ip++
            break

          case op.PUSH_UNDEFINED: // PUSH_UNDEFINED
            yield stack.push("undefined")
            ip++
            break

          case op.PUSH_NULL: // PUSH_NULL
            yield stack.push("null")
            ip++
            break

          case op.PUSH_FAILED: // PUSH_FAILED
            yield stack.push("peg$FAILED")
            ip++
            break

          case op.PUSH_EMPTY_ARRAY: // PUSH_EMPTY_ARRAY
            yield stack.push("[]")
            ip++
            break

          case op.POP: // POP
            stack.pop()
            ip++
            break

          case op.POP_CURR_POS: // POP_CURR_POS
            yield `peg$currPos = ${stack.pop()};`
            ip++
            break

          case op.POP_N: // POP_N n
            stack.pop2(nextByteCode())
            ip += 2
            break

          case op.NIP: // NIP
            value = stack.pop()
            stack.pop()
            yield stack.push(value)
            ip++
            break

          case op.APPEND: // APPEND
            value = stack.pop()
            yield `${stack.top()}.push(${value});`
            ip++
            break

          case op.WRAP: // WRAP n
            yield stack.push(`[${stack.pop2(nextByteCode()).join(", ")}]`)
            ip += 2
            break

          case op.TEXT: // TEXT
            yield stack.push(`input.substring(${stack.pop()}, peg$currPos)`)
            ip++
            break

          case op.PLUCK: {
            // PLUCK n, k, p1, ..., pK
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

          case op.IF: // IF t, f
            yield* compileCondition(stack.top(), 0)
            break

          case op.IF_ERROR: // IF_ERROR t, f
            yield* compileCondition(`${stack.top()} === peg$FAILED`, 0)
            break

          case op.IF_NOT_ERROR: // IF_NOT_ERROR t, f
            yield* compileCondition(`${stack.top()} !== peg$FAILED`, 0)
            break

          case op.WHILE_NOT_ERROR: // WHILE_NOT_ERROR b
            yield* compileLoop(`${stack.top()} !== peg$FAILED`)
            break

          case op.MATCH_ANY: // MATCH_ANY a, f, ...
            yield* compileCondition("input.length > peg$currPos", 0)
            break

          case op.MATCH_STRING: // MATCH_STRING s, a, f, ...
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

          case op.MATCH_STRING_IC: // MATCH_STRING_IC s, a, f, ...
            yield* compileCondition(
              `input.substr(peg$currPos, ${
                ast.literals[nextByteCode()].length
              }).toLowerCase() === ${l(nextByteCode())}`,
              1
            )
            break

          case op.MATCH_CLASS: // MATCH_CLASS c, a, f, ...
            yield* compileCondition(
              `${r(nextByteCode())}.test(input.charAt(peg$currPos))`,
              1
            )
            break

          case op.ACCEPT_N: // ACCEPT_N n
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

          case op.ACCEPT_STRING: // ACCEPT_STRING s
            yield stack.push(l(nextByteCode()))
            yield ast.literals[nextByteCode()].length > 1
              ? `peg$currPos += ${ast.literals[nextByteCode()].length};`
              : "peg$currPos++;"
            ip += 2
            break

          case op.EXPECT: // EXPECT e
            yield `rule$expects(${e(nextByteCode())});`
            ip += 2
            break

          case op.LOAD_SAVED_POS: // LOAD_SAVED_POS p
            yield `peg$savedPos = ${stack.index(nextByteCode())};`
            ip += 2
            break

          case op.UPDATE_SAVED_POS: // UPDATE_SAVED_POS
            yield "peg$savedPos = peg$currPos;"
            ip++
            break

          case op.CALL: // CALL f, n, pc, p1, p2, ..., pN
            yield* compileCall()
            break

          case op.RULE: // RULE r
            yield stack.push(`peg$parse${ast.rules[nextByteCode()].name}()`)
            ip += 2
            break

          case op.SILENT_FAILS_ON: // SILENT_FAILS_ON
            yield "peg$silentFails++;"
            ip++
            break

          case op.SILENT_FAILS_OFF: // SILENT_FAILS_OFF
            yield "peg$silentFails--;"
            ip++
            break

          case op.EXPECT_NS_BEGIN: // EXPECT_NS_BEGIN
            yield "peg$begin();"
            ip++
            break

          case op.EXPECT_NS_END: // EXPECT_NS_END invert
            yield `peg$end(${nextByteCode() !== 0});`
            ip += 2
            break

          // istanbul ignore next
          default:
            session.fatal(
              `Rule '${rule.name}', position ${ip}: Invalid opcode ${bc[ip]}.`
            )
        }
      }
    }

    // Exhaust the compilation first because maxSp is needed before
    // yielding the full code
    const code = join(compile(rule.bytecode!))

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

  function* generateTopLevel(): StringGenerator {
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
  }

  function generateWrapper(topLevelCode: StringGenerator): StringGenerator {
    function* generateHeaderComment(): StringGenerator {
      yield `// Generated by PEG.js v${VERSION}, https://pegjs.org/`
      const header = options.header

      if (isString(header)) {
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
      *commonjs(): StringGenerator {
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

        if (!isEmpty(options.dependencies)) {
          yield* map(
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

      *es(): StringGenerator {
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

        if (!isEmpty(options.dependencies)) {
          yield* map(
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

  const value = join(generateWrapper(generateTopLevel()))
  ast.code = value
  // ast.code = join(generateWrapper(generateTopLevel()))
}
