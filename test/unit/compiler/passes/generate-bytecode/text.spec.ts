import "../useHelpers"
import { compiler } from "pegjs"
import { expect } from "chai"
import { bytecodeDetails } from "./shared"
import { generateBytecode } from "pegjs/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for text", () => {
  it("generates correct bytecode", () => {
    expect(generateBytecode).to.changeAST(
      "start = $'a'",
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
        o.PUSH_NULL,
        o.PUSH_UNDEFINED, // IF_NOT_ERROR
        o.POP, //   * POP
        o.TEXT, //     TEXT
        o.NIP //   * NIP
      )
    )
  })
})
