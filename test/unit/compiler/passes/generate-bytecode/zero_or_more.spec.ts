import "../useHelpers"
import { compiler } from "pegjs"
import { expect } from "chai"
import { generateBytecode } from "pegjs/lib/compiler/passes/generate-bytecode"
import { bytecodeDetails, constsDetails } from "./shared"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for zero_or_more", () => {
  const grammar = "start = 'a'*"

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
        o.WHILE_NOT_ERROR,
        o.APPEND, // WHILE_NOT_ERROR
        o.APPEND, //   * APPEND
        o.EXPECT,
        o.PUSH_EMPTY_STRING,
        o.MATCH_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_NULL,
        o.PUSH_UNDEFINED,
        o.ACCEPT_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_FAILED, //     <expression>
        o.POP // POP
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
