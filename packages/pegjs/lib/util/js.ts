function hex(ch: string) {
  return ch.charCodeAt(0).toString(16).toUpperCase()
}

/* eslint-disable no-control-regex */
function sourceEscape(s: string) {
  return s
    .replace(/\0/g, "\\0") // null
    .replace(/\x08/g, "\\b") // backspace
    .replace(/\t/g, "\\t") // horizontal tab
    .replace(/\n/g, "\\n") // line feed
    .replace(/\v/g, "\\v") // vertical tab
    .replace(/\f/g, "\\f") // form feed
    .replace(/\r/g, "\\r") // carriage return
    .replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch))
    .replace(/[\x10-\x1F\x7F-\xFF]/g, ch => "\\x" + hex(ch))
    .replace(/[\u0100-\u0FFF]/g, ch => "\\u0" + hex(ch))
    .replace(/[\u1000-\uFFFF]/g, ch => "\\u" + hex(ch))
}
/* eslint-enable no-control-regex */

/**
 * Based on ECMA-262, 5th ed., 7.8.5 & 15.10.1.
 *
 * For portability, we also escape all control and non-ASCII characters.
 */
export function regexpEscape(s: string) {
  return sourceEscape(
    s
      .replace(/\\/g, "\\\\") // backslash
      .replace(/\//g, "\\/") // closing slash
      .replace(/]/g, "\\]") // closing bracket
      .replace(/\^/g, "\\^") // caret
      .replace(/-/g, "\\-") // dash
  )
}

/**
 * This is a list of reserved words for ECMA-262, 5th ed., 7.6.1 (strict mode)
 */
export const reservedWords = [
  // Keyword
  "break",
  "case",
  "catch",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "finally",
  "for",
  "function",
  "if",
  "in",
  "instanceof",
  "new",
  "return",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",

  // FutureReservedWord
  "class",
  "const",
  "enum",
  "export",
  "extends",
  "implements",
  "import",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "super",
  "yield",

  // Literal
  "false",
  "null",
  "true",
]
