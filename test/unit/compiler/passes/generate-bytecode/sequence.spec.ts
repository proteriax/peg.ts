import "../useHelpers"
import { compiler } from "@pegjs/main"
import { expect } from "chai"
import { bytecodeDetails, constsDetails } from "./shared"
import { generateBytecode } from "@pegjs/main/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for sequence", () => {
  const grammar = "start = 'a' 'b' 'c'"

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
        35, // ???
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
        o.MATCH_STRING_IC,
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
        o.PUSH_FAILED,
        o.PUSH_EMPTY_ARRAY, //         IF_NOT_ERROR
        o.WRAP,
        o.PUSH_FAILED, //           * WRAP
        o.NIP, //             NIP
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
        []
      )
    )
  })

  it("generates correct plucking bytecode", () => {
    expect(generateBytecode).to.changeAST(
      "start = 'a' @'b' 'c'",
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
        36, // ?
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
        o.MATCH_CLASS,
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
        o.PUSH_EMPTY_ARRAY,
        o.PUSH_EMPTY_ARRAY, //         IF_NOT_ERROR
        o.PLUCK,
        o.PUSH_EMPTY_ARRAY,
        o.PUSH_UNDEFINED,
        o.PUSH_UNDEFINED, //           * PLUCK
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

    expect(generateBytecode).to.changeAST(
      "start = 'a' @'b' @'c'",
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
        37, // ?
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
        o.ACCEPT_N,
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
        o.PUSH_CURR_POS,
        o.PUSH_EMPTY_ARRAY, //         IF_NOT_ERROR
        o.PLUCK,
        o.PUSH_EMPTY_ARRAY,
        o.PUSH_NULL,
        o.PUSH_UNDEFINED,
        o.PUSH_EMPTY_STRING, //           * PLUCK
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
})
