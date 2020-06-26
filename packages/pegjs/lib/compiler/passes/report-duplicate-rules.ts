import type { Grammar } from "../../ast/Grammar"
import type { Session } from "../session"
import type { SourceLocation } from "../../../typings/generated-parser"

// Checks that each rule is defined only once.
export function reportDuplicateRules(ast: Grammar, session: Session) {
  const rules = new Map<string, SourceLocation>()

  const check = session.buildVisitor({
    rule(node) {
      const name = node.name
      if (rules.has(name)) {
        const start = rules.get(name)!.start
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
