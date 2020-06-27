import "../useHelpers"
import { compiler } from "@pegjs/main"
import { expect } from "chai"
import { bytecodeDetails, constsDetails } from "./shared"
import { generateBytecode } from "@pegjs/main/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for one_or_more", () => {
  const grammar = "start = 'a'+"

  it("generates correct bytecode", () => {
    expect(generateBytecode).to.changeAST(
      grammar,
      bytecodeDetails(
        o.PUSH_EMPTY_ARRAY, // PUSH_EMPTY_ARRAY
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
        o.IF,
        o.PUSH_FAILED, // IF_NOT_ERROR
        o.WHILE_NOT_ERROR,
        o.APPEND, //   * WHILE_NOT_ERROR
        o.APPEND, //       * APPEND
        o.EXPECT,
        o.PUSH_EMPTY_STRING,
        o.MATCH_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_NULL,
        o.PUSH_UNDEFINED,
        o.ACCEPT_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_FAILED, //         <expression>
        o.POP, //     POP
        o.POP, //   * POP
        o.POP, //     POP
        o.PUSH_FAILED //     PUSH_FAILED
      )
    )
  })

  it("defines correct constants", () => {
    expect(generateBytecode).to.changeAST(
      grammar,
      constsDetails(["a"], [], [{ type: "literal", value: "a", ignoreCase: false }], [])
    )
  })
})
