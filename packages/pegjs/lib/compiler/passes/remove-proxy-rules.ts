import type { Grammar } from "../../ast/Grammar"
import type { Session } from "../session"
import type { ICompilerPassOptions } from "../mod"
import { Rule, RuleReferenceExpression } from "../../ast/Node"

// Removes proxy rules -- that is, rules that only delegate to other rule.
export function removeProxyRules(
  ast: Grammar,
  session: Session,
  options: ICompilerPassOptions
) {
  function isProxyRule(node: Rule): node is Rule<RuleReferenceExpression> {
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
  const rules: Rule[] = []

  ast.rules.forEach(rule => {
    if (isProxyRule(rule)) {
      replaceRuleRefs(ast, rule.name, rule.expression.name)
      if (!allowedStartRules.includes(rule.name)) return
    }

    rules.push(rule)
  })

  ast.rules = rules
}
