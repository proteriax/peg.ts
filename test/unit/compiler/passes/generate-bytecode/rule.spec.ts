import "../useHelpers"
import { compiler } from "@pegjs/main"
import { expect } from "chai"
import { bytecodeDetails } from "./shared"
import { generateBytecode } from "@pegjs/main/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for rule", () => {
  it("generates correct bytecode", () => {
    expect(generateBytecode).to.changeAST(
      "start = 'a'",
      bytecodeDetails(
        o.EXPECT,
        o.PUSH_EMPTY_STRING,
        o.MATCH_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_NULL,
        o.PUSH_UNDEFINED,
        o.ACCEPT_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_FAILED // <expression>
      )
    )
  })
})
