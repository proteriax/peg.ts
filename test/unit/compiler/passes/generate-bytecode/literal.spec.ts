import "../useHelpers"
import { compiler } from "@pegjs/main"
import { expect } from "chai"
import { generateBytecode } from "@pegjs/main/lib/compiler/passes/generate-bytecode"
import { bytecodeDetails, constsDetails } from "./shared"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for literal", () => {
  describe("when |reportFailures=true|", () => {
    describe("empty", () => {
      const grammar = "start = ''"

      it("generates correct bytecode", () => {
        expect(generateBytecode).to.changeAST(
          grammar,
          bytecodeDetails(
            o.PUSH_EMPTY_STRING // PUSH_EMPTY_STRING
          )
        )
      })

      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(grammar, constsDetails([], [], [], []))
      })
    })

    describe("non-empty case-sensitive", () => {
      const grammar = "start = 'a'"

      it("generates correct bytecode", () => {
        expect(generateBytecode).to.changeAST(
          grammar,
          bytecodeDetails(
            o.EXPECT,
            o.PUSH_EMPTY_STRING, // EXPECT <0>
            o.MATCH_STRING,
            o.PUSH_EMPTY_STRING,
            o.PUSH_NULL,
            o.PUSH_UNDEFINED, // MATCH_STRING <0>
            o.ACCEPT_STRING,
            o.PUSH_EMPTY_STRING, //   * ACCEPT_STRING <0>
            o.PUSH_FAILED //   * PUSH_FAILED
          )
        )
      })

      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          grammar,
          constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "a", ignoreCase: false }],
            []
          )
        )
      })
    })

    describe("non-empty case-insensitive", () => {
      const grammar = "start = 'A'i"

      it("generates correct bytecode", () => {
        expect(generateBytecode).to.changeAST(
          grammar,
          bytecodeDetails(
            o.EXPECT,
            o.PUSH_EMPTY_STRING, // EXPECT <0>
            o.MATCH_STRING_IC,
            o.PUSH_EMPTY_STRING,
            o.PUSH_NULL,
            o.PUSH_UNDEFINED, // MATCH_STRING_IC <0>
            o.ACCEPT_N,
            o.PUSH_UNDEFINED, //   * ACCEPT_N <1>
            o.PUSH_FAILED //   * PUSH_FAILED
          )
        )
      })

      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          grammar,
          constsDetails(
            ["a"],
            [],
            [{ type: "literal", value: "A", ignoreCase: true }],
            []
          )
        )
      })
    })
  })

  describe("when |reportFailures=false|", () => {
    describe("empty", () => {
      const grammar = "start = ''"

      it("generates correct bytecode", () => {
        expect(generateBytecode).to.changeAST(
          grammar,
          bytecodeDetails(
            o.PUSH_EMPTY_STRING // PUSH_EMPTY_STRING
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

    describe("non-empty case-sensitive", () => {
      const grammar = "start = 'a'"

      it("generates correct bytecode", () => {
        expect(generateBytecode).to.changeAST(
          grammar,
          bytecodeDetails(
            o.MATCH_STRING,
            o.PUSH_EMPTY_STRING,
            o.PUSH_NULL,
            o.PUSH_UNDEFINED, // MATCH_STRING <0>
            o.ACCEPT_STRING,
            o.PUSH_EMPTY_STRING, //   * ACCEPT_STRING <0>
            o.PUSH_FAILED //   * PUSH_FAILED
          ),
          {},
          { reportFailures: false }
        )
      })

      it("defines correct constants", () => {
        expect(generateBytecode).to.changeAST(
          grammar,
          constsDetails(["a"], [], [], []),
          {},
          { reportFailures: false }
        )
      })
    })

    describe("non-empty case-insensitive", () => {
      const grammar = "start = 'A'i"

      it("generates correct bytecode", () => {
        expect(generateBytecode).to.changeAST(
          grammar,
          bytecodeDetails(
            o.MATCH_STRING_IC,
            o.PUSH_EMPTY_STRING,
            o.PUSH_NULL,
            o.PUSH_UNDEFINED, // MATCH_STRING_IC <0>
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
          constsDetails(["a"], [], [], []),
          {},
          { reportFailures: false }
        )
      })
    })
  })
})
