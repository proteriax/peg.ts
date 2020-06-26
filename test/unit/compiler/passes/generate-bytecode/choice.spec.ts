import "../useHelpers"
import { compiler } from "pegjs"
import { expect } from "chai"
import { generateBytecode } from "pegjs/lib/compiler/passes/generate-bytecode"
import { bytecodeDetails } from "./shared"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for choice", () => {
  it("generates correct bytecode", () => {
    expect(generateBytecode).to.changeAST(
      "start = 'a' / 'b' / 'c'",
      bytecodeDetails(
        o.EXPECT,
        o.PUSH_EMPTY_STRING,
        o.MATCH_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_NULL,
        o.PUSH_UNDEFINED,
        o.ACCEPT_STRING,
        o.PUSH_EMPTY_STRING,
        o.PUSH_FAILED, // <alternatives[0]>
        o.IF_ERROR,
        o.EXPECT,
        o.PUSH_EMPTY_STRING, // IF_ERROR
        o.POP, //   * POP
        o.EXPECT,
        o.PUSH_UNDEFINED,
        o.MATCH_STRING,
        o.PUSH_UNDEFINED,
        o.PUSH_NULL,
        o.PUSH_UNDEFINED,
        o.ACCEPT_STRING,
        o.PUSH_UNDEFINED,
        o.PUSH_FAILED, //     <alternatives[1]>
        o.IF_ERROR,
        o.APPEND,
        o.PUSH_EMPTY_STRING, //     IF_ERROR
        o.POP, //       * POP
        o.EXPECT,
        o.PUSH_NULL,
        o.MATCH_STRING,
        o.PUSH_NULL,
        o.PUSH_NULL,
        o.PUSH_UNDEFINED,
        o.ACCEPT_STRING,
        o.PUSH_NULL,
        o.PUSH_FAILED //         <alternatives[2]>
      )
    )
  })
})
