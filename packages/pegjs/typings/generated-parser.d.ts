/**
 * Provides information pointing to a location within a source.
 */
export interface SourcePosition {
  offset: number
  line: number
  column: number
}

/**
 * The `start` and `end` position's of an object within the source.
 */
export interface SourceLocation {
  filename?: string
  start: SourcePosition
  end: SourcePosition
}

/**
 * An object that can be used to make a generated parser trace it's progress.
 */
export interface ITracer {
  trace(event: {
    type: string
    rule: string
    result?: string
    location: SourceLocation
  }): void
}

interface ISyntaxError<T> {
  name: string
  message: string
  stack?: string | any
  expected?: T
  found?: string
  location: SourceLocation
}

interface SyntaxError<T> {
  new (
    message: string,
    expected: T,
    found: string | null,
    location: SourceLocation
  ): ISyntaxError<T>
  readonly prototype: ISyntaxError<T>

  buildMessage(expected: T, found?: string, location?: SourceLocation): string
}

export interface SyntaxExpectation {
  type: string
  description?: string
  text?: string
  parts?: string[]
  inverted?: boolean
  ignoreCase?: boolean
  expected?: SyntaxExpectation
}

interface LiteralExpectation {
  type: "literal"
  text: string
  ignoreCase: boolean
}

interface ClassExpectation {
  type: "class"
  parts: string[]
  inverted: boolean
  ignoreCase: boolean
}

interface AnyExpectation {
  type: "any"
}

interface EndExpectation {
  type: "end"
}

interface OtherExpectation {
  type: "other"
  description: string
}

interface NotExpectation {
  type: "not"
  expected: SyntaxExpectation
}

type SyntaxErrorConstructor =
  | SyntaxError<LiteralExpectation>
  | SyntaxError<ClassExpectation>
  | SyntaxError<AnyExpectation>
  | SyntaxError<EndExpectation>
  | SyntaxError<OtherExpectation>
  | SyntaxError<NotExpectation>
  | SyntaxError<SyntaxExpectation>

/**
 * Default options that are shared by all generated parser's.
 */
export interface IOptions {
  [key: string]: any
  filename?: string
  startRule?: string
  tracer?: ITracer
}

/**
 * API for the parser generated by PEG.js
 */
export interface API<T = any> {
  SyntaxError: SyntaxErrorConstructor
  DefaultTracer?: ITracer
  parse(input: string, options?: IOptions): T
}
