import "./useHelpers"
import chai from "chai"
import { compiler } from "@pegjs/main"

const pass = compiler.passes.check.reportDuplicateRules

const expect = chai.expect

describe("compiler pass |reportsDuplicateRules|", function () {
  it("reports duplicate rules", function () {
    expect(pass).to.reportError(["start = 'a'", "start = 'b'"].join("\n"), {
      message: 'Rule "start" is already defined at line 1, column 1.',
      location: {
        start: { offset: 12, line: 2, column: 1 },
        end: { offset: 23, line: 2, column: 12 },
      },
    })
  })
})
