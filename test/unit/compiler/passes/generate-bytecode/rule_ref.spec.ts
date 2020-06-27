import "../useHelpers"
import { expect } from "chai"
import { generateBytecode } from "@pegjs/main/lib/compiler/passes/generate-bytecode"

describe("compiler pass |generateBytecode| for rule_ref", () => {
  it("generates correct bytecode", () => {
    expect(generateBytecode).to.changeAST(
      ["start = other", "other = 'other'"].join("\n"),
      {
        rules: [
          {
            bytecode: [27, 1], // RULE
          },
          {},
        ],
      }
    )
  })
})
