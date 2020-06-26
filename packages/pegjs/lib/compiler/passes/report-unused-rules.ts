import type { Grammar } from "../../ast/Grammar"
import type { Session } from "../session"
import type { ICompilerPassOptions } from "../mod"
import type { RuleReferenceExpression } from "../../ast/Node"

// Checks that all rules are used.
export function reportUnusedRules(
  ast: Grammar,
  session: Session,
  options: ICompilerPassOptions
) {
  const used = new Set<string | RuleReferenceExpression>()

  function yes(node: string | RuleReferenceExpression): any {
    used.add((node as RuleReferenceExpression).name || node)
  }

  options.allowedStartRules.forEach(yes)
  session.buildVisitor({ rule_ref: yes })(ast)

  ast.rules.forEach(rule => {
    if (!used.has(rule.name)) {
      session.warn(`Rule "${rule.name}" is not referenced.`, rule.location)
    }
  })
}
