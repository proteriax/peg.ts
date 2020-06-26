import "../useHelpers"
import { compiler } from "pegjs"
import { expect } from "chai"
import { bytecodeDetails, constsDetails } from "./shared"
import { generateBytecode } from "pegjs/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for action", () => {
  describe("without labels", () => {
    const grammar = "start = 'a' { code }"

    it("generates correct bytecode", () => {
      expect(generateBytecode).to.changeAST(
        grammar,
        bytecodeDetails(
          o.PUSH_CURR_POS, // PUSH_CURR_POS
          o.EXPECT,
          o.PUSH_EMPTY_STRING,
          o.MATCH_STRING,
          o.PUSH_EMPTY_STRING,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_STRING,
          o.PUSH_EMPTY_STRING,
          o.PUSH_FAILED, // <expression>
          o.IF_NOT_ERROR,
          o.POP,
          o.PUSH_EMPTY_STRING, // IF_NOT_ERROR
          o.LOAD_SAVED_POS,
          o.PUSH_UNDEFINED, //   * LOAD_SAVED_POS
          o.CALL,
          o.PUSH_EMPTY_STRING,
          o.PUSH_UNDEFINED,
          o.PUSH_EMPTY_STRING, //     CALL <0>
          o.NIP // NIP
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
          [{ predicate: false, params: [], body: " code " }]
        )
      )
    })
  })

  describe("with one label", () => {
    const grammar = "start = a:'a' { code }"

    it("generates correct bytecode", () => {
      expect(generateBytecode).to.changeAST(
        grammar,
        bytecodeDetails(
          o.PUSH_CURR_POS, // PUSH_CURR_POS
          o.EXPECT,
          o.PUSH_EMPTY_STRING,
          o.MATCH_STRING,
          o.PUSH_EMPTY_STRING,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_STRING,
          o.PUSH_EMPTY_STRING,
          o.PUSH_FAILED, // <expression>
          o.IF_NOT_ERROR,
          o.POP_CURR_POS,
          o.PUSH_EMPTY_STRING, // IF_NOT_ERROR
          o.LOAD_SAVED_POS,
          o.PUSH_UNDEFINED, //   * LOAD_SAVED_POS
          o.CALL,
          o.PUSH_EMPTY_STRING,
          o.PUSH_UNDEFINED,
          o.PUSH_UNDEFINED,
          o.PUSH_EMPTY_STRING, //     CALL <0>
          o.NIP // NIP
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
          [{ predicate: false, params: ["a"], body: " code " }]
        )
      )
    })
  })

  describe("with multiple labels", () => {
    const grammar = "start = a:'a' b:'b' c:'c' { code }"

    it("generates correct bytecode", () => {
      expect(generateBytecode).to.changeAST(
        grammar,
        bytecodeDetails(
          o.PUSH_CURR_POS, // PUSH_CURR_POS
          o.EXPECT,
          o.PUSH_EMPTY_STRING,
          o.MATCH_STRING,
          o.PUSH_EMPTY_STRING,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_STRING,
          o.PUSH_EMPTY_STRING,
          o.PUSH_FAILED, // <elements[0]>
          o.IF_NOT_ERROR,
          o.PLUCK,
          o.PUSH_FAILED, // IF_NOT_ERROR
          o.EXPECT,
          o.PUSH_UNDEFINED,
          o.MATCH_STRING,
          o.PUSH_UNDEFINED,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_STRING,
          o.PUSH_UNDEFINED,
          o.PUSH_FAILED, //   * <elements[1]>
          o.IF_NOT_ERROR,
          o.UPDATE_SAVED_POS,
          o.PUSH_EMPTY_ARRAY, //     IF_NOT_ERROR
          o.EXPECT,
          o.PUSH_NULL,
          o.MATCH_STRING,
          o.PUSH_NULL,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_STRING,
          o.PUSH_NULL,
          o.PUSH_FAILED, //       * <elements[2]>
          o.IF_NOT_ERROR,
          o.NIP,
          o.PUSH_EMPTY_ARRAY, //         IF_NOT_ERROR
          o.LOAD_SAVED_POS,
          o.PUSH_FAILED, //           * LOAD_SAVED_POS
          o.CALL,
          o.PUSH_EMPTY_STRING,
          o.PUSH_EMPTY_ARRAY,
          o.PUSH_FAILED,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.PUSH_EMPTY_STRING, //             CALL <0>
          o.POP_N,
          o.PUSH_FAILED, //           * POP_N
          o.POP_CURR_POS, //             POP_CURR_POS
          o.PUSH_FAILED, //             PUSH_FAILED
          o.POP_N,
          o.PUSH_NULL, //       * POP_N
          o.POP_CURR_POS, //         POP_CURR_POS
          o.PUSH_FAILED, //         PUSH_FAILED
          o.POP, //   * POP
          o.POP_CURR_POS, //     POP_CURR_POS
          o.PUSH_FAILED //     PUSH_FAILED
        )
      )
    })

    it("defines correct constants", () => {
      expect(generateBytecode).to.changeAST(
        grammar,
        constsDetails(
          ["a", "b", "c"],
          [],
          [
            { type: "literal", value: "a", ignoreCase: false },
            { type: "literal", value: "b", ignoreCase: false },
            { type: "literal", value: "c", ignoreCase: false },
          ],
          [{ predicate: false, params: ["a", "b", "c"], body: " code " }]
        )
      )
    })
  })
})
