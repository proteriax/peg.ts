import type { SourceLocation } from "../../typings/generated-parser"

/**
 * PEG.js node constructor, used internally by the PEG.js parser to create nodes.
 */
export class Node {
  constructor(readonly type: string, readonly location: SourceLocation) {
    this.type = type
    this.location = location
  }
}

export interface INode extends Node {
  // Added by inference-match-result pass
  match: number
}

export interface Rule<Exp extends INode = Named | Expression> extends INode {
  // Default properties
  type: "rule"
  name: string
  expression: Exp

  // Added by calc-report-failures pass
  reportFailures?: boolean

  // Added by generate-bytecode pass
  bytecode?: number[]
}

export interface Named extends INode {
  type: "named"
  name: string
  expression: Expression
}

export type Expression =
  | ChoiceExpression
  | ActionExpression
  | SequenceExpression
  | LabeledExpression
  | PrefixedExpression
  | SuffixedExpression
  | PrimaryExpression

export interface ChoiceExpression extends INode {
  type: "choice"
  alternatives: (
    | ActionExpression
    | SequenceExpression
    | LabeledExpression
    | PrefixedExpression
    | SuffixedExpression
    | PrimaryExpression
  )[]
}

export interface ActionExpression extends INode {
  type: "action"
  expression:
    | SequenceExpression
    | LabeledExpression
    | PrefixedExpression
    | SuffixedExpression
    | PrimaryExpression
  code: string
}

export interface SequenceExpression extends INode {
  type: "sequence"
  elements: (
    | LabeledExpression
    | PrefixedExpression
    | SuffixedExpression
    | PrimaryExpression
  )[]
}

export interface LabeledExpression extends INode {
  type: "labeled"
  pick?: true
  label: string
  expression: PrefixedExpression | SuffixedExpression | PrimaryExpression
}

export interface PrefixedExpression extends INode {
  type: "text" | "simple_and" | "simple_not"
  expression: SuffixedExpression | PrimaryExpression
}

export interface SuffixedExpression extends INode {
  type: "optional" | "zero_or_more" | "one_or_more"
  expression: PrimaryExpression
}

export type PrimaryExpression =
  | LiteralMatcher
  | CharacterClassMatcher
  | AnyMatcher
  | RuleReferenceExpression
  | SemanticPredicateExpression
  | GroupExpression

export interface LiteralMatcher extends INode {
  type: "literal"
  value: string
  ignoreCase: boolean
}

export interface CharacterClassMatcher extends INode {
  type: "class"
  parts: (string[] | string)[]
  inverted: boolean
  ignoreCase: boolean
}

export type ParsedClass = Omit<CharacterClassMatcher, keyof INode | "type" | "parts">

export interface AnyMatcher extends INode {
  type: "any"
}

export interface RuleReferenceExpression extends INode {
  type: "rule_ref"
  name: string
}

export interface SemanticPredicateExpression extends INode {
  type: "semantic_and" | "semantic_not"
  code: string
}

export interface GroupExpression extends INode {
  type: "group"
  expression: LabeledExpression | SequenceExpression
}
