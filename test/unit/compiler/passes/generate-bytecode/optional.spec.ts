import "../useHelpers"
import { compiler } from "pegjs"
import { expect } from "chai"
import { bytecodeDetails, constsDetails } from "./shared"
import { generateBytecode } from "pegjs/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for optional", () => {
  const grammar = "start = 'a'?"

  it("generates correct bytecode", () => {
    expect(generateBytecode).to.changeAST(
      grammar,
      bytecodeDetails(
        o.EXPECT,
        o.PUSH_EMPTY_STRING,
        o.MATCH_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_NULL,
        o.PUSH_UNDEFINED,
        o.ACCEPT_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_FAILED, // <expression>
        o.IF_ERROR,
        o.PUSH_NULL,
        o.PUSH_EMPTY_STRING, // IF_ERROR
        o.POP, //   * POP
        o.PUSH_NULL //     PUSH_NULL
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
