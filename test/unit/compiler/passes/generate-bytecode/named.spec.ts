import "../useHelpers"
import { compiler } from "@pegjs/main"
import { expect } from "chai"
import { bytecodeDetails, constsDetails } from "./shared"
import { generateBytecode } from "@pegjs/main/lib/compiler/passes/generate-bytecode"

const o = compiler.opcodes

describe("compiler pass |generateBytecode| for named", () => {
  const grammar1 = "start 'start' = ."
  const grammar2 = "start 'start' = 'a'"
  const grammar3 = "start 'start' = [a]"

  describe("when |reportFailures=true|", () => {
    it("generates correct bytecode", () => {
      expect(generateBytecode).to.changeAST(
        grammar1,
        bytecodeDetails(
          o.EXPECT,
          o.PUSH_EMPTY_STRING, // EXPECT <0>
          o.SILENT_FAILS_ON, // SILENT_FAILS_ON
          o.MATCH_ANY,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_N,
          o.PUSH_UNDEFINED,
          o.PUSH_FAILED, // <expression>
          o.SILENT_FAILS_OFF // SILENT_FAILS_OFF
        )
      )

      expect(generateBytecode).to.changeAST(
        grammar2,
        bytecodeDetails(
          o.EXPECT,
          o.PUSH_EMPTY_STRING, // EXPECT <0>
          o.SILENT_FAILS_ON, // SILENT_FAILS_ON
          o.MATCH_STRING,
          o.PUSH_EMPTY_STRING,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_STRING,
          o.PUSH_EMPTY_STRING,
          o.PUSH_FAILED, // <expression>
          o.SILENT_FAILS_OFF // SILENT_FAILS_OFF
        )
      )

      expect(generateBytecode).to.changeAST(
        grammar3,
        bytecodeDetails(
          o.EXPECT,
          o.PUSH_EMPTY_STRING, // EXPECT <0>
          o.SILENT_FAILS_ON, // SILENT_FAILS_ON
          o.MATCH_CLASS,
          o.PUSH_EMPTY_STRING,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_N,
          o.PUSH_UNDEFINED,
          o.PUSH_FAILED, // <expression>
          o.SILENT_FAILS_OFF // SILENT_FAILS_OFF
        )
      )
    })

    it("defines correct constants", () => {
      expect(generateBytecode).to.changeAST(
        grammar1,
        constsDetails([], [], [{ type: "rule", value: "start" }], [])
      )
      expect(generateBytecode).to.changeAST(
        grammar2,
        constsDetails(["a"], [], [{ type: "rule", value: "start" }], [])
      )
      expect(generateBytecode).to.changeAST(
        grammar3,
        constsDetails(
          [],
          [{ value: ["a"], inverted: false, ignoreCase: false }],
          [{ type: "rule", value: "start" }],
          []
        )
      )
    })
  })

  describe("when |reportFailures=false|", () => {
    it("generates correct bytecode", () => {
      expect(generateBytecode).to.changeAST(
        grammar1,
        bytecodeDetails(
          o.MATCH_ANY,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_N,
          o.PUSH_UNDEFINED,
          o.PUSH_FAILED // <expression>
        ),
        {},
        { reportFailures: false }
      )
      expect(generateBytecode).to.changeAST(
        grammar2,
        bytecodeDetails(
          o.MATCH_STRING,
          o.PUSH_EMPTY_STRING,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_STRING,
          o.PUSH_EMPTY_STRING,
          o.PUSH_FAILED // <expression>
        ),
        {},
        { reportFailures: false }
      )
      expect(generateBytecode).to.changeAST(
        grammar3,
        bytecodeDetails(
          o.MATCH_CLASS,
          o.PUSH_EMPTY_STRING,
          o.PUSH_NULL,
          o.PUSH_UNDEFINED,
          o.ACCEPT_N,
          o.PUSH_UNDEFINED,
          o.PUSH_FAILED // <expression>
        ),
        {},
        { reportFailures: false }
      )
    })

    it("defines correct constants", () => {
      expect(generateBytecode).to.changeAST(
        grammar1,
        constsDetails([], [], [], []),
        {},
        { reportFailures: false }
      )
      expect(generateBytecode).to.changeAST(
        grammar2,
        constsDetails(["a"], [], [], []),
        {},
        { reportFailures: false }
      )
      expect(generateBytecode).to.changeAST(
        grammar3,
        constsDetails([], [{ value: ["a"], inverted: false, ignoreCase: false }], [], []),
        {},
        { reportFailures: false }
      )
    })
  })
})
