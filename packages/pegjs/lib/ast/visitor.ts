import { noop } from "lodash"
import { INode } from "./Node"
import * as n from "./Node"
import type { Grammar } from "./Grammar"

export interface Initializer extends INode {
  type: "initializer"
  code: string
}

// Abstract syntax tree visitor for PEG.js
export class ASTVisitor<U> implements IVisitorMap<U> {
  constructor(visitors: Partial<ASTVisitor<U>>) {
    Object.assign(this, visitors)
    this.visit = this.visit.bind(this)
  }

  // Will traverse the node, strictly assuming the visitor can handle the node type.
  visit(node: INode, ..._args: any[]) {
    // istanbul ignore next
    if (!node) {
      throw new Error("Visitor function called with no arguments or a `falsy` node")
    }

    const fn = this[node.type]

    // istanbul ignore next
    if (!fn) {
      console.log(this)
      throw new Error(`Visitor function for node type "${node.type}" not defined`)
    }

    return fn.apply(this, arguments) // eslint-disable-line prefer-rest-params
  }

  grammar(node: Grammar, ...extraArgs: any[]): any {
    if (node.initializer) {
      this.visit(node.initializer, ...extraArgs)
    }

    node.rules.forEach(rule => {
      this.visit(rule, ...extraArgs)
    })
  }

  choice(node: n.ChoiceExpression, ...extraArgs: any[]): any {
    node.alternatives.forEach(child => this.visit(child, ...extraArgs))
  }

  sequence(node: n.SequenceExpression, ...extraArgs: any[]): any {
    node.elements.forEach(child => this.visit(child, ...extraArgs))
  }
}

Object.assign(ASTVisitor.prototype, {
  initializer: noop as any,
  rule: visitExpression,
  named: visitExpression,
  action: visitExpression,
  labeled: visitExpression,
  text: visitExpression,
  simple_and: visitExpression,
  simple_not: visitExpression,
  optional: visitExpression,
  zero_or_more: visitExpression,
  one_or_more: visitExpression,
  group: visitExpression,
  semantic_and: noop as any,
  semantic_not: noop as any,
  rule_ref: noop as any,
  literal: noop as any,
  class: noop as any,
  any: noop as any,
})

// Simple AST node visitor builder for PEG.js
export function build<T = void, R = any>(functions: IVisitorMap<T>): IVisitor<R> {
  return new ASTVisitor(functions).visit as todo
}

export interface IVisitor<R = any> {
  (node: INode, ...args): R
}

export interface IVisitorBuilder<T = void, R = any> {
  (functions: IVisitorMap<T>): IVisitor<R>
}

// Build the default ast visitor functions

function visitExpression(
  this: ASTVisitor<any>,
  node: INode & { expression: INode },
  ...extraArgs: any[]
): any {
  this.visit(node.expression, ...extraArgs)
}

export interface IVisitorMap<T = void> {
  [key: string]: any
  grammar?(node: Grammar, ...args: any[]): T
  initializer?(node: Initializer, ...args: any[]): T
  rule?(node: n.Rule, ...args: any[]): T
  named?(node: n.Named, ...args: any[]): T
  choice?(node: n.ChoiceExpression, ...args: any[]): T
  action?(node: n.ActionExpression, ...args: any[]): T
  sequence?(node: n.SequenceExpression, ...args: any[]): T
  labeled?(node: n.LabeledExpression, ...args: any[]): T
  text?(node: n.PrefixedExpression, ...args: any[]): T
  simple_and?(node: n.PrefixedExpression, ...args: any[]): T
  simple_not?(node: n.PrefixedExpression, ...args: any[]): T
  optional?(node: n.SuffixedExpression, ...args: any[]): T
  zero_or_more?(node: n.SuffixedExpression, ...args: any[]): T
  one_or_more?(node: n.SuffixedExpression, ...args: any[]): T
  literal?(node: n.LiteralMatcher, ...args: any[]): T
  class?(node: n.CharacterClassMatcher, ...args: any[]): T
  any?(node: n.AnyMatcher, ...args: any[]): T
  rule_ref?(node: n.RuleReferenceExpression, ...args: any[]): T
  semantic_and?(node: n.SemanticPredicateExpression, ...args: any[]): T
  semantic_not?(node: n.SemanticPredicateExpression, ...args: any[]): T
  group?(node: n.GroupExpression, ...args: any[]): T
}
