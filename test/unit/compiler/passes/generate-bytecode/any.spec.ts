import "../useHelpers"
import { compiler } from "pegjs"
import { expect } from "chai"
import { bytecodeDetails, constsDetails } from "./shared"
import { generateBytecode } from "pegjs/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for any", () => {
  describe("when |reportFailures=true|", () => {
    const grammar = "start = ."

    it("generates bytecode", () => {
      expect(generateBytecode).to.changeAST(
        grammar,
        bytecodeDetails(
          o.EXPECT,
          o.PUSH_EMPTY_STRING, // EXPECT <0>
          o.MATCH_ANY,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED, // MATCH_ANY
          o.ACCEPT_N,
          o.PUSH_UNDEFINED, //   * ACCEPT_N <1>
          o.PUSH_FAILED //   * PUSH_FAILED
        )
      )
    })

    it("defines correct constants", () => {
      expect(generateBytecode).to.changeAST(
        grammar,
        constsDetails([], [], [{ type: "any" }], [])
      )
    })
  })

  describe("when |reportFailures=false|", () => {
    const grammar = "start = ."

    it("generates bytecode", () => {
      expect(generateBytecode).to.changeAST(
        grammar,
        bytecodeDetails(
          o.MATCH_ANY,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED, // MATCH_ANY
          o.ACCEPT_N,
          o.PUSH_UNDEFINED, //   * ACCEPT_N <1>
          o.PUSH_FAILED //   * PUSH_FAILED
        ),
        {},
        { reportFailures: false }
      )
    })

    it("defines correct constants", () => {
      expect(generateBytecode).to.changeAST(
        grammar,
        constsDetails([], [], [], []),
        {},
        { reportFailures: false }
      )
    })
  })
})
