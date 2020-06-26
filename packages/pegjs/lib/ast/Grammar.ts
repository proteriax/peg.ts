import {
  Node,
  Rule,
  ChoiceExpression,
  SequenceExpression,
  RuleReferenceExpression,
  LiteralMatcher,
  INode,
} from "./Node"
import { Initializer, ASTVisitor } from "./visitor"
import type { SourceLocation } from "../../typings/generated-parser"

/**
 * The main PEG.js AST class returned by the parser.
 */
export class Grammar extends Node {
  // Default properties and methods

  private readonly _alwaysConsumesOnSuccess: any
  type: "grammar"
  comments?: CommentMap
  initializer?: Initializer
  rules: Rule[]

  // Added by Bytecode generator
  literals: string[]
  classes: string[]
  expectations: string[]
  functions: string[]

  // Added by JavaScript generator
  code?: string

  // Creates a new AST

  constructor(
    initializer: undefined | Initializer,
    rules: Rule[],
    comments: undefined | CommentMap,
    location: SourceLocation
  ) {
    super("grammar", location)

    this.initializer = initializer
    this.comments = comments
    this.rules = rules

    // eslint-disable-next-line no-use-before-define
    this._alwaysConsumesOnSuccess = new AlwaysConsumesOnSuccess(this)
  }

  alwaysConsumesOnSuccess(node: Object): boolean {
    return this._alwaysConsumesOnSuccess.visit(node)
  }

  findRule(name: string): Rule | undefined {
    return this.rules.find(rule => rule.name === name)
  }

  indexOfRule(name: string): number {
    return this.rules.findIndex(rule => rule.name === name)
  }
}

/* ***************************** @private ***************************** */

class AlwaysConsumesOnSuccess extends ASTVisitor<boolean> {
  constructor(readonly ast: Grammar) {
    super()
  }

  choice(node: ChoiceExpression) {
    return node.alternatives.every(this.visit, this)
  }

  sequence(node: SequenceExpression) {
    return node.elements.some(this.visit, this)
  }

  rule_ref(node: RuleReferenceExpression) {
    return this.visit(this.ast.findRule(node.name))
  }

  literal(node: LiteralMatcher) {
    return node.value !== ""
  }
}

function consumesTrue() {
  return true
}

function consumesFalse() {
  return false
}

function consumesExpression(
  this: AlwaysConsumesOnSuccess,
  node: INode & { expression: INode }
) {
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

interface CommentMap {
  [offset: number]: {
    text: string
    multiline: boolean
    location: SourceLocation
  }
}
