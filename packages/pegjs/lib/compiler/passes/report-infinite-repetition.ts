import type { Grammar } from "../../ast/Grammar"
import type { Session } from "../session"

// Reports expressions that don't consume any input inside |*| or |+| in the
// grammar, which prevents infinite loops in the generated parser.
export function reportInfiniteRepetition(ast: Grammar, session: Session) {
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
