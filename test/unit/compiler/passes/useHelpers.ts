import { isString, forEach } from "lodash"
import { util, Assertion, use, expect } from "chai"
import LikeHelper from "chai-like"
import { Session } from "pegjs/lib/compiler/session"

declare global {
  namespace Chai {
    interface Assertion {
      changeAST(
        grammar: string,
        props?: object,
        options?: { allowedStartRules?: string[] },
        additionalRuleProps?: { reportFailures?: boolean }
      ): Assertion
      reportError(grammar: string, props?: string | object, options?: object): Assertion
      reportWarning(
        grammar: string,
        warnings?: string | string[],
        options?: object
      ): Assertion
    }
  }
}

function parse(
  grammar: string,
  session: Session,
  options: { allowedStartRules?: string[] }
) {
  const ast = session.parse(grammar)

  if (!options.allowedStartRules) {
    options.allowedStartRules = ast.rules.length ? [ast.rules[0].name] : []
  }

  return ast
}

use(LikeHelper)
use(() => {
  Assertion.addMethod("changeAST", function (
    grammar,
    props,
    options = {},
    additionalRuleProps = { reportFailures: true }
  ) {
    const session = new Session({ grammar })
    const ast = parse(grammar, session, options)

    ast.rules = ast.rules.map(rule => Object.assign(rule, additionalRuleProps))

    util.flag(this, "object")(ast, session, options)

    expect(ast).like(props)
  } as Chai.Assertion["changeAST"])

  Assertion.addMethod("reportError", function (grammar, props, options = {}) {
    const session = new Session({ grammar })
    const ast = parse(grammar, session, options)

    let passed: boolean
    let result

    try {
      util.flag(this, "object")(ast, session, options)
      passed = true
    } catch (e) {
      result = e
      passed = false
    }

    this.assert(
      !passed,
      "expected #{this} to report an error but it didn't",
      "expected #{this} to not report an error but #{act} was reported",
      null,
      result
    )

    if (!passed && props !== undefined) {
      if (isString(props)) {
        props = { message: props }
      }

      forEach(props, (value, key) => {
        expect(result).to.have.property(key).that.is.deep.equal(value)
      })
    }
  } as Chai.Assertion["reportError"])

  Assertion.addMethod("reportWarning", function (grammar, warnings = [], options = {}) {
    warnings = Array.isArray(warnings) ? warnings : [warnings]

    const messages: string[] = []
    function warn(message: string) {
      messages.push(message)
    }

    const session = new Session({ grammar, warn })
    const ast = parse(grammar, session, options)

    util.flag(this, "object")(ast, session, options)

    const messagesCount = messages.length
    const warningsCount = warnings.length

    if (warnings.length)
      this.assert(
        messagesCount === warningsCount,
        `expected #{this} to report ${warningsCount} warnings, but it reported ${messagesCount} warnings`,
        `expected #{this} to not report ${warningsCount} warnings`,
        warnings,
        messages
      )

    warnings.forEach(warning => {
      this.assert(
        messages.indexOf(warning) !== -1,
        "expected #{this} to report the warning #{exp}, but it didn't",
        "expected #{this} to not report the warning #{exp}",
        warning
      )
    })
  } as Chai.Assertion["reportWarning"])
})
