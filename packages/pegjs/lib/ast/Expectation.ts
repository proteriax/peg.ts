export type Expectation =
  | LiteralExpectation
  | ClassExpectation
  | AnyExpectation
  | EndExpectation
  | OtherExpectation

export interface LiteralExpectation {
  readonly type: "literal"
  readonly text: string
  readonly ignoreCase: boolean
}

export interface ClassExpectation {
  readonly type: "class"
  readonly parts: (string | string[])[]
  readonly inverted: boolean
  readonly ignoreCase: boolean
}

export interface AnyExpectation {
  readonly type: "any"
}

export interface EndExpectation {
  readonly type: "end"
}

export interface OtherExpectation {
  readonly type: "other"
  readonly description: string
}
