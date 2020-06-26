import type { Session } from "../session"
import { INode } from "../../ast/Node"

// Checks that each label is defined only once within each scope.
export function reportDuplicateLabels(ast: Grammar, session: Session) {
  function checkExpressionWithClonedEnv(node: INode & { expression: INode }, env: any) {
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
