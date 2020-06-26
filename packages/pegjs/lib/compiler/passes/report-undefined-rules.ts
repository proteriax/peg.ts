import type { Grammar } from "../../ast/Grammar"
import type { Session } from "../session"
import type { ICompilerPassOptions } from "../mod"

// Checks that all referenced rules exist.
export function reportUndefinedRules(
  ast: Grammar,
  session: Session,
  options: ICompilerPassOptions
) {
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
