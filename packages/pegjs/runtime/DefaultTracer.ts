export class peg$DefaultTracer implements Tracer {
  #indentLevel = 0

  trace(event: TraceEvent) {
    const log = () => {
      const { location, type, rule } = event
      const { start, end } = location
      console?.log(
        `${start.line}:${start.column}-${end.line}:${end.column} ` +
          type.padEnd(10) +
          " ".repeat(this.#indentLevel * 2 + 1) +
          rule
      )
    }

    switch (event.type) {
      case "rule.enter":
        log()
        this.#indentLevel++
        break

      case "rule.match":
        this.#indentLevel--
        log()
        break

      case "rule.fail":
        this.#indentLevel--
        log()
        break

      default:
        throw new Error(`Invalid event type: ${(event as any).type}.`)
    }
  }
}
