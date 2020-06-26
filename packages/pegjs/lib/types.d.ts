type todo = any

interface Tracer {
  trace(event: TraceEvent): void
}

type TraceEvent =
  | {
      type: "rule.match"
      rule: string
      result: any
      location: Location
    }
  | {
      type: "rule.fail"
      rule: string
      location: Location
    }
  | {
      type: "rule.enter"
      rule: string
      location: Location
    }

interface Position {
  line: number
  column: number
  readonly offset?: number
}

interface Location {
  readonly start: Position
  readonly end: Position
}

interface ParserOptions {
  /** Set to `null` to disable tracing. */
  readonly tracer?: Tracer | null
  readonly startRule?: string
}
