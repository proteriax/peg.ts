import type { SourceLocation } from "../typings/generated-parser"

/**
 * Thrown when the grammar contains an error.
 */
export class GrammarError {
  name: string

  constructor(readonly message: string, readonly location?: SourceLocation) {
    this.name = "GrammarError"
    Error.captureStackTrace?.(this, GrammarError)
  }
}
