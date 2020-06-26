import type { Grammar } from "../../ast/Grammar"
import type { Session } from "../session"

// Reports left recursion in the grammar, which prevents infinite recursion in
// the generated parser.
//
// Both direct and indirect recursion is detected. The pass also correctly
// reports cases like this:
//
//   start = "a"? start
//
// In general, if a rule reference can be reached without consuming any input,
// it can lead to left recursion.
export function reportInfiniteRecursion(ast: Grammar, session: Session) {
  const visitedRules: string[] = []

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

      check(ast.findRule(node.name)!)
    },
  })

  check(ast)
}
