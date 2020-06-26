import { SourceLocation } from "pegjs/typings/api"

export class peg$SyntaxError extends Error {
  constructor(
    message: string,
    readonly expected: null | Expectation[],
    readonly found: null | string,
    readonly location: Location
  ) {
    super(message)
    this.expected = expected
    this.name = "PEG.SyntaxError"
    Error.captureStackTrace?.(this, peg$SyntaxError)
  }

  static buildMessage(expected: Expectation[], found: null | string) {
    const DESCRIBE_EXPECTATION_FNS = {
      literal: ({ text }: LiteralExpectation) => `"${literalEscape(text)}"`,

      class: ({ inverted, parts }: ClassExpectation) =>
        "[" +
        (inverted ? "^" : "") +
        parts
          .map(part =>
            Array.isArray(part)
              ? `${classEscape(part[0])}-${classEscape(part[1])}`
              : classEscape(part)
          )
          .join("") +
        "]",

      any: (expectation: AnyExpectation) => "any character",
      end: (expectation: EndExpectation) => "end of input",
      other: ({ description }: OtherExpectation) => description,
      not: ({ expected }) => describeExpectation(expected),
    }

    function hex(ch: string) {
      return ch.charCodeAt(0).toString(16).toUpperCase()
    }

    function literalEscape(s: string) {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\0/g, "\\0")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch))
        .replace(/[\x10-\x1F\x7F-\x9F]/g, ch => "\\x" + hex(ch))
    }

    function classEscape(s: string) {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/\]/g, "\\]")
        .replace(/\^/g, "\\^")
        .replace(/-/g, "\\-")
        .replace(/\0/g, "\\0")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch))
        .replace(/[\x10-\x1F\x7F-\x9F]/g, ch => "\\x" + hex(ch))
    }

    function describeExpectation(expectation: Expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation as any)
    }

    function describeExpected(expected: Expectation[]) {
      const descriptions = expected.map(describeExpectation).sort()

      if (descriptions.length > 0) {
        let j = 1
        for (let i = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i]
            j++
          }
        }
        descriptions.length = j
      }

      switch (descriptions.length) {
        case 1:
          return descriptions[0]

        case 2:
          return `${descriptions[0]} or ${descriptions[1]}`

        default:
          return (
            descriptions.slice(0, -1).join(", ") +
            ", or " +
            descriptions[descriptions.length - 1]
          )
      }
    }

    function describeFound(found: null | string) {
      return found ? `"${literalEscape(found)}"` : "end of input"
    }

    return `Expected ${describeExpected(expected)} but ${describeFound(found)} found.`
  }
}

export function peg$buildSimpleError(message: string, location: SourceLocation) {
  return new peg$SyntaxError(message, null, null, location)
}

export function peg$buildStructuredError(expected, found, location) {
  return new peg$SyntaxError(
    peg$SyntaxError.buildMessage(expected, found, location),
    expected,
    found,
    location
  )
}
