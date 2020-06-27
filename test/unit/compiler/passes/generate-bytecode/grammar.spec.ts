import "../useHelpers"
import { compiler } from "@pegjs/main"
import { expect } from "chai"
import { constsDetails } from "./shared"
import { generateBytecode } from "@pegjs/main/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for grammar", () => {
  it("generates correct bytecode", () => {
    expect(generateBytecode).to.changeAST(["a = 'a'", "b = 'b'", "c = 'c'"].join("\n"), {
      rules: [
        {
          bytecode: [
            o.EXPECT,
            o.PUSH_EMPTY_STRING,
            o.MATCH_STRING,
            o.PUSH_EMPTY_STRING,
            o.PUSH_NULL,
            o.PUSH_UNDEFINED,
            o.ACCEPT_STRING,
            o.PUSH_EMPTY_STRING,
            o.PUSH_FAILED,
          ],
        },
        {
          bytecode: [
            o.EXPECT,
            o.PUSH_UNDEFINED,
            o.MATCH_STRING,
            o.PUSH_UNDEFINED,
            o.PUSH_NULL,
            o.PUSH_UNDEFINED,
            o.ACCEPT_STRING,
            o.PUSH_UNDEFINED,
            o.PUSH_FAILED,
          ],
        },
        {
          bytecode: [
            o.EXPECT,
            o.PUSH_NULL,
            o.MATCH_STRING,
            o.PUSH_NULL,
            o.PUSH_NULL,
            o.PUSH_UNDEFINED,
            o.ACCEPT_STRING,
            o.PUSH_NULL,
            o.PUSH_FAILED,
          ],
        },
      ],
    })
  })

  it("defines correct constants", () => {
    expect(generateBytecode).to.changeAST(
      ["a = 'a'", "b = 'b'", "c = 'c'"].join("\n"),
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
})
