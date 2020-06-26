import "../useHelpers"
import { compiler } from "pegjs"
import { expect } from "chai"
import { bytecodeDetails, constsDetails } from "./shared"
import { generateBytecode } from "pegjs/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for class", () => {
  describe("when |reportFailures=true|", () => {
    it("generates correct bytecode", () => {
      expect(generateBytecode).to.changeAST(
        "start = [a]",
        bytecodeDetails(
          o.EXPECT,
          o.PUSH_EMPTY_STRING, // EXPECT <0>
          o.MATCH_CLASS,
          o.PUSH_EMPTY_STRING,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED, // MATCH_CLASS <0>
          o.ACCEPT_N,
          o.PUSH_UNDEFINED, //   * ACCEPT_N <1>
          o.PUSH_FAILED //   * PUSH_FAILED
        )
      )
    })

    describe("non-inverted case-sensitive", () => {
      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          "start = [a]",
          constsDetails(
            [],
            [{ value: ["a"], inverted: false, ignoreCase: false }],
            [{ type: "class", value: ["a"], inverted: false, ignoreCase: false }],
            []
          )
        )
      })
    })

    describe("inverted case-sensitive", () => {
      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          "start = [^a]",
          constsDetails(
            [],
            [{ value: ["a"], inverted: true, ignoreCase: false }],
            [{ type: "class", value: ["a"], inverted: true, ignoreCase: false }],
            []
          )
        )
      })
    })

    describe("non-inverted case-insensitive", () => {
      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          "start = [a]i",
          constsDetails(
            [],
            [{ value: ["a"], inverted: false, ignoreCase: true }],
            [{ type: "class", value: ["a"], inverted: false, ignoreCase: true }],
            []
          )
        )
      })
    })

    describe("complex", () => {
      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          "start = [ab-def-hij-l]",
          constsDetails(
            [],
            [
              {
                value: ["a", ["b", "d"], "e", ["f", "h"], "i", ["j", "l"]],
                inverted: false,
                ignoreCase: false,
              },
            ],
            [
              {
                type: "class",
                value: ["a", ["b", "d"], "e", ["f", "h"], "i", ["j", "l"]],
                inverted: false,
                ignoreCase: false,
              },
            ],
            []
          )
        )
      })
    })
  })

  describe("when |reportFailures=false|", () => {
    it("generates correct bytecode", () => {
      expect(generateBytecode).to.changeAST(
        "start = [a]",
        bytecodeDetails(
          o.MATCH_CLASS,
          o.PUSH_EMPTY_STRING,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED, // MATCH_CLASS <0>
          o.ACCEPT_N,
          o.PUSH_UNDEFINED, //   * ACCEPT_N <1>
          o.PUSH_FAILED //   * PUSH_FAILED
        ),
        {},
        { reportFailures: false }
      )
    })

    describe("non-inverted case-sensitive", () => {
      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          "start = [a]",
          constsDetails(
            [],
            [{ value: ["a"], inverted: false, ignoreCase: false }],
            [],
            []
          ),
          {},
          { reportFailures: false }
        )
      })
    })

    describe("inverted case-sensitive", () => {
      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          "start = [^a]",
          constsDetails(
            [],
            [{ value: ["a"], inverted: true, ignoreCase: false }],
            [],
            []
          ),
          {},
          { reportFailures: false }
        )
      })
    })

    describe("non-inverted case-insensitive", () => {
      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          "start = [a]i",
          constsDetails(
            [],
            [{ value: ["a"], inverted: false, ignoreCase: true }],
            [],
            []
          ),
          {},
          { reportFailures: false }
        )
      })
    })

    describe("complex", () => {
      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          "start = [ab-def-hij-l]",
          constsDetails(
            [],
            [
              {
                value: ["a", ["b", "d"], "e", ["f", "h"], "i", ["j", "l"]],
                inverted: false,
                ignoreCase: false,
              },
            ],
            [],
            []
          ),
          {},
          { reportFailures: false }
        )
      })
    })
  })
})
