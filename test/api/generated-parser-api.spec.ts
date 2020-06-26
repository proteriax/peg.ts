import { expect } from "chai"
import * as peg from "pegjs"
import sinon from "sinon"

describe("generated parser API", () => {
  describe("parse", () => {
    it("parses input", () => {
      const parser = peg.generate("start = 'a'")
      expect(parser.parse("a")).to.equal("a")
    })

    it("throws an exception on syntax error", () => {
      const parser = peg.generate("start = 'a'")
      expect(() => parser.parse("b")).to.throw()
    })

    describe("start rule", () => {
      const parser = peg.generate(
        `
          a = 'x' { return 'a'; }
          b = 'x' { return 'b'; }
          c = 'x' { return 'c'; }
        `,
        { allowedStartRules: ["b", "c"] }
      )

      describe("when |startRule| is not set", () => {
        it("starts parsing from the first allowed rule", () => {
          expect(parser.parse("x")).to.equal("b")
        })
      })

      describe("when |startRule| is set to an allowed rule", () => {
        it("starts parsing from specified rule", () => {
          expect(parser.parse("x", { startRule: "b" })).to.equal("b")
          expect(parser.parse("x", { startRule: "c" })).to.equal("c")
        })
      })

      describe("when |startRule| is set to a disallowed start rule", () => {
        it("throws an exception", () => {
          expect(() => {
            parser.parse("x", { startRule: "a" })
          }).to.throw()
        })
      })
    })

    describe("tracing", () => {
      const parser = peg.generate(
        `
          start = a / b
          a = 'a'
          b = 'b'
        `,
        { trace: true }
      )

      describe("default tracer", () => {
        it("traces using console.log (if console is defined)", () => {
          const messages = [
            "1:1-1:1 rule.enter start",
            "1:1-1:1 rule.enter   a",
            "1:1-1:1 rule.fail    a",
            "1:1-1:1 rule.enter   b",
            "1:1-1:2 rule.match   b",
            "1:1-1:2 rule.match start",
          ]

          const log = sinon.stub(console, "log")

          try {
            parser.parse("b")

            if (typeof console === "object") {
              expect(log.callCount).to.equal(messages.length)
              messages.forEach((message, index) => {
                const call = log.getCall(index)
                expect(call.calledWithExactly(message)).to.equal(true)
              })
            }
          } finally {
            log.restore()
          }
        })
      })

      describe("custom tracers", () => {
        describe("trace", () => {
          it("receives tracing events", () => {
            const events = [
              {
                type: "rule.enter",
                rule: "start",
                location: {
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 0, line: 1, column: 1 },
                },
              },
              {
                type: "rule.enter",
                rule: "a",
                location: {
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 0, line: 1, column: 1 },
                },
              },
              {
                type: "rule.fail",
                rule: "a",
                location: {
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 0, line: 1, column: 1 },
                },
              },
              {
                type: "rule.enter",
                rule: "b",
                location: {
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 0, line: 1, column: 1 },
                },
              },
              {
                type: "rule.match",
                rule: "b",
                result: "b",
                location: {
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 1, line: 1, column: 2 },
                },
              },
              {
                type: "rule.match",
                rule: "start",
                result: "b",
                location: {
                  start: { offset: 0, line: 1, column: 1 },
                  end: { offset: 1, line: 1, column: 2 },
                },
              },
            ]

            const tracer = { trace: sinon.spy() }
            parser.parse("b", { tracer })

            expect(tracer.trace.callCount).to.equal(events.length)
            events.forEach((event, index) => {
              const call = tracer.trace.getCall(index)
              expect(call.calledWithExactly(event)).to.equal(true)
            })
          })
        })
      })
    })

    it("accepts custom options", () => {
      const parser = peg.generate("start = 'a'")
      parser.parse("a", { foo: 42 })
    })
  })
})
