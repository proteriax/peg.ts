import "./useHelpers"
import { expect } from "chai"
import { compiler } from "@pegjs/main"

const pass = compiler.passes.check.reportUndefinedRules

describe("compiler pass |reportUndefinedRules|", function () {
  it("reports undefined rules", function () {
    expect(pass).to.reportError("start = undefined", {
      message: 'Rule "undefined" is not defined.',
      location: {
        start: { offset: 8, line: 1, column: 9 },
        end: { offset: 17, line: 1, column: 18 },
      },
    })
  })

  it("checks allowedStartRules", function () {
    expect(pass).to.reportError(
      "start = 'a'",
      {
        message: 'Start rule "missing" is not defined.',
      },
      {
        allowedStartRules: ["missing"],
      }
    )
  })
})
