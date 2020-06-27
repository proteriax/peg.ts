import "../useHelpers"
import { compiler } from "@pegjs/main"
import { expect } from "chai"
import { bytecodeDetails, constsDetails } from "./shared"
import { generateBytecode } from "@pegjs/main/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for simple_and", () => {
  const grammar = "start = &'a'"

  it("generates correct bytecode", () => {
    expect(generateBytecode).to.changeAST(
      grammar,
      bytecodeDetails(
        o.PUSH_CURR_POS, // PUSH_CURR_POS
        o.EXPECT_NS_BEGIN, // EXPECT_NS_BEGIN
        o.EXPECT,
        o.PUSH_EMPTY_STRING,
        o.MATCH_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_NULL,
        o.PUSH_UNDEFINED,
        o.ACCEPT_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_FAILED, // <expression>
        o.EXPECT_NS_END,
        o.PUSH_EMPTY_STRING, // EXPECT_NS_END <false>
        o.IF_NOT_ERROR,
        o.PUSH_FAILED,
        o.PUSH_FAILED, // IF_NOT_ERROR
        o.POP, //   * POP
        o.POP_CURR_POS, //     POP_CURR_POS
        o.PUSH_UNDEFINED, //     PUSH_UNDEFINED
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
