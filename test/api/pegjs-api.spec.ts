import { expect } from "chai"
import * as peg from "@pegjs/main"
import sinon from "sinon"
import { transpile } from "@pegjs/main/lib/typescript"

describe("PEG.js API", () => {
  describe("generate", () => {
    it("generates a parser", () => {
      const parser = peg.generate("start = 'a'")

      expect(parser).to.be.an("object")
      expect(parser.parse("a")).to.equal("a")
    })

    it("throws an exception on syntax error", () => {
      expect(() => peg.generate("start = @")).to.throw()
    })

    it("throws an exception on semantic error", () => {
      expect(() => peg.generate("start = undefined")).to.throw()
    })

    describe("allowed start rules", () => {
      const grammar = `
        a = 'x'
        b = 'x'
        c = 'x'
      `

      it("throws an error on missing rule", () => {
        expect(() => {
          peg.generate(grammar, { allowedStartRules: ["missing"] })
        }).to.throw()
      })

      // The |allowedStartRules| option is implemented separately for each
      // optimization mode, so we need to test it in both.

      describe("when optimizing for parsing speed", () => {
        describe("when |allowedStartRules| is not set", () => {
          it("generated parser can start only from the first rule", () => {
            const parser = peg.generate(grammar, { optimize: "speed" })

            expect(parser.parse("x", { startRule: "a" })).to.equal("x")
            expect(() => {
              parser.parse("x", { startRule: "b" })
            }).to.throw()
            expect(() => {
              parser.parse("x", { startRule: "c" })
            }).to.throw()
          })
        })

        describe("when |allowedStartRules| is set", () => {
          it("generated parser can start only from specified rules", () => {
            const parser = peg.generate(grammar, {
              optimize: "speed",
              allowedStartRules: ["b", "c"],
            })

            expect(() => {
              parser.parse("x", { startRule: "a" })
            }).to.throw()
            expect(parser.parse("x", { startRule: "b" })).to.equal("x")
            expect(parser.parse("x", { startRule: "c" })).to.equal("x")
          })
        })
      })

      describe("when optimizing for code size", () => {
        describe("when |allowedStartRules| is not set", () => {
          it("generated parser can start only from the first rule", () => {
            const parser = peg.generate(grammar, { optimize: "size" })

            expect(parser.parse("x", { startRule: "a" })).to.equal("x")
            expect(() => {
              parser.parse("x", { startRule: "b" })
            }).to.throw()
            expect(() => {
              parser.parse("x", { startRule: "c" })
            }).to.throw()
          })
        })

        describe("when |allowedStartRules| is set", () => {
          it("generated parser can start only from specified rules", () => {
            const parser = peg.generate(grammar, {
              optimize: "size",
              allowedStartRules: ["b", "c"],
            })

            expect(() => {
              parser.parse("x", { startRule: "a" })
            }).to.throw()
            expect(parser.parse("x", { startRule: "b" })).to.equal("x")
            expect(parser.parse("x", { startRule: "c" })).to.equal("x")
          })
        })
      })
    })

    describe("intermediate results caching", () => {
      const grammar = `

                { var n = 0; }
                start = (a 'b') / (a 'c') { return n; }
                a = 'a' { n++; }

            `

      describe("when |cache| is not set", () => {
        it("generated parser doesn't cache intermediate parse results", () => {
          const parser = peg.generate(grammar)
          expect(parser.parse("ac")).to.equal(2)
        })
      })

      describe("when |cache| is set to |false|", () => {
        it("generated parser doesn't cache intermediate parse results", () => {
          const parser = peg.generate(grammar, { cache: false })
          expect(parser.parse("ac")).to.equal(2)
        })
      })

      describe("when |cache| is set to |true|", () => {
        it("generated parser caches intermediate parse results", () => {
          const parser = peg.generate(grammar, { cache: true })
          expect(parser.parse("ac")).to.equal(1)
        })
      })
    })

    describe("tracing", () => {
      const grammar = "start = 'a'"

      describe("when |trace| is not set", () => {
        it("generated parser doesn't trace", () => {
          const parser = peg.generate(grammar)
          const tracer = { trace: sinon.spy() }

          parser.parse("a", { tracer })

          expect(tracer.trace.called).to.equal(false)
        })
      })

      describe("when |trace| is set to |false|", () => {
        it("generated parser doesn't trace", () => {
          const parser = peg.generate(grammar, { trace: false })
          const tracer = { trace: sinon.spy() }

          parser.parse("a", { tracer })

          expect(tracer.trace.called).to.equal(false)
        })
      })

      describe("when |trace| is set to |true|", () => {
        it("generated parser traces", () => {
          const parser = peg.generate(grammar, { trace: true })
          const tracer = { trace: sinon.spy() }

          parser.parse("a", { tracer })

          expect(tracer.trace.called).to.equal(true)
        })
      })
    })

    // The |optimize| option isn't tested because there is no meaningful way to
    // write the tests without turning this into a performance test.

    describe("output", () => {
      const grammar = "start = 'a'"

      describe("when |output| is not set", () => {
        it("returns generated parser object", () => {
          const parser = peg.generate(grammar)

          expect(parser).to.be.an("object")
          expect(parser.parse("a")).to.equal("a")
        })
      })

      describe('when |output| is set to |"parser"|', () => {
        it("returns generated parser object", () => {
          const parser = peg.generate(grammar, { output: "parser" })

          expect(parser).to.be.an("object")
          expect(parser.parse("a")).to.equal("a")
        })
      })

      describe('when |output| is set to |"source"|', () => {
        it("returns generated parser source code", async () => {
          const source = peg.generate(grammar, { output: "source" })
          expect(source).to.be.a("string")
          expect(eval(transpile(source)).parse("a")).to.equal("a")
        })
      })
    })

    // The |format|, |exportVars|, and |dependencies| options are not tested
    // because there is no meaningful way to test their effects without turning
    // this into an integration test.

    // The |plugins| option is tested in plugin API tests.

    describe("reserved words", () => {
      const RESERVED_WORDS = peg.util.reservedWords

      describe("throws an exception on reserved JS words used as labels", () => {
        for (const label of RESERVED_WORDS) {
          it(label, () => {
            expect(() => {
              peg.generate([`start = ${label}:end`, "end = 'a'"].join("\n"), {
                output: "source",
              })
            }).to.throw(peg.parser.SyntaxError)
          })
        }
      })

      describe("not throws an exception on reserved JS words used as rule name", () => {
        for (const rule of RESERVED_WORDS) {
          it(rule, () => {
            expect(() =>
              peg.generate([`start = ${rule}`, `${rule} = 'a'`].join("\n"), {
                output: "source",
              })
            ).to.not.throw(peg.parser.SyntaxError)
          })
        }
      })
    })

    it("accepts custom options", () => {
      peg.generate("start = 'a'", { foo: 42 })
    })
  })
})
