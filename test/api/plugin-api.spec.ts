import { expect } from "chai"
import * as peg from "@pegjs/main"

describe("plugin API", () => {
  describe("use", () => {
    const grammar = "start = 'a'"

    it("is called for each plugin", () => {
      const pluginsUsed = [false, false, false, false]
      const plugins = [
        {
          use() {
            pluginsUsed[0] = true
          },
        },
        {
          use() {
            pluginsUsed[1] = true
          },
        },
        () => {
          pluginsUsed[2] = true
        },
        () => {
          pluginsUsed[3] = true
        },
      ]

      peg.generate(grammar, { plugins })

      expect(pluginsUsed).to.deep.equal([true, true, true, true])
    })

    it("receives configuration", () => {
      peg.generate(grammar, {
        plugins: [
          config => {
            expect(config).to.be.an("object")
            expect(config.parser).to.be.an("object")
            expect(config.parser.parse("start = 'a'")).to.be.an("object")

            expect(config.passes).to.be.an("object")

            expect(config.passes.check).to.be.an("array")
            config.passes.check.forEach(pass => {
              expect(pass).to.be.a("function")
            })

            expect(config.passes.transform).to.be.an("array")
            config.passes.transform.forEach(pass => {
              expect(pass).to.be.a("function")
            })

            expect(config.passes.generate).to.be.an("array")
            config.passes.generate.forEach(pass => {
              expect(pass).to.be.a("function")
            })
          },
        ],
      })
    })

    it("receives options", () => {
      const generateOptions = {
        plugins: [
          (config, options) => {
            expect(options).to.equal(generateOptions)
          },
        ],
        foo: 42,
      }

      peg.generate(grammar, generateOptions)
    })

    it("can replace parser", () => {
      const parser = peg.generate("a", {
        plugins: [
          config => {
            config.parser = peg.generate(
              `
              start = .* {
                return new ast.Grammar(undefined, [{
                  type: "rule",
                  name: "start",
                  expression: {
                    type: "literal",
                    value: text(),
                    ignoreCase: false,
                  }
                }]);
              }
            `,
              { context: { ast: peg.ast } }
            )
          },
        ],
      })
      expect(parser.parse("a")).to.equal("a")
    })

    it("can change compiler passes", () => {
      const parser = peg.generate(grammar, {
        plugins: [
          config => {
            config.passes.generate = [
              ast => {
                ast.code = "exports.parse = function() { return 42; }"
              },
            ]
          },
        ],
      })
      expect(parser.parse("a")).to.equal(42)
    })

    it("can change options", () => {
      const grammar = `
        a = 'x'
        b = 'x'
        c = 'x'
      `

      const parser = peg.generate(grammar, {
        allowedStartRules: ["a"],
        plugins: [
          (_config, options) => {
            options.allowedStartRules = ["b", "c"]
          },
        ],
      })

      expect(() => parser.parse("x", { startRule: "a" })).to.throw()
      expect(parser.parse("x", { startRule: "b" })).to.equal("x")
      expect(parser.parse("x", { startRule: "c" })).to.equal("x")
    })
  })
})
