export function peg$literalExpectation(text: string, ignoreCase: boolean) {
  return { type: "literal", text, ignoreCase }
}

export function peg$classExpectation(parts, inverted: boolean, ignoreCase: boolean) {
  return { type: "class", parts, inverted, ignoreCase }
}

export function peg$anyExpectation() {
  return { type: "any" }
}

export function peg$endExpectation() {
  return { type: "end" }
}

export function peg$otherExpectation(description: string) {
  return { type: "other", description }
}
