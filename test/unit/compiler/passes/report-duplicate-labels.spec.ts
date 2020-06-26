import "./useHelpers"
import { expect } from "chai"
import { reportDuplicateLabels as pass } from "pegjs/lib/compiler/passes/report-duplicate-labels"

describe("compiler pass |reportDuplicateLabels|", () => {
  describe("in a sequence", () => {
    it("reports labels duplicate with labels of preceding elements", () => {
      expect(pass).to.reportError("start = a:'a' a:'a'", {
        message: 'Label "a" is already defined at line 1, column 9.',
        location: {
          start: { offset: 14, line: 1, column: 15 },
          end: { offset: 19, line: 1, column: 20 },
        },
      })
    })

    it("doesn't report labels duplicate with labels in sub-expressions", () => {
      expect(pass).to.not.reportError("start = ('a' / a:'a' / 'a') a:'a'")
      expect(pass).to.not.reportError("start = (a:'a' { }) a:'a'")
      expect(pass).to.not.reportError("start = ('a' a:'a' 'a') a:'a'")
      expect(pass).to.not.reportError("start = b:(a:'a') a:'a'")
      expect(pass).to.not.reportError("start = $(a:'a') a:'a'")
      expect(pass).to.not.reportError("start = &(a:'a') a:'a'")
      expect(pass).to.not.reportError("start = !(a:'a') a:'a'")
      expect(pass).to.not.reportError("start = (a:'a')? a:'a'")
      expect(pass).to.not.reportError("start = (a:'a')* a:'a'")
      expect(pass).to.not.reportError("start = (a:'a')+ a:'a'")
      expect(pass).to.not.reportError("start = (a:'a') a:'a'")
    })
  })

  describe("in a choice", () => {
    it("doesn't report labels duplicate with labels of preceding alternatives", () => {
      expect(pass).to.not.reportError("start = a:'a' / a:'a'")
    })
  })

  describe("in outer sequence", () => {
    it("reports labels duplicate with labels of preceding elements", () => {
      expect(pass).to.reportError("start = a:'a' (a:'a')", {
        message: 'Label "a" is already defined at line 1, column 9.',
        location: {
          start: { offset: 15, line: 1, column: 16 },
          end: { offset: 20, line: 1, column: 21 },
        },
      })
    })

    it("doesn't report labels duplicate with the label of the current element", () => {
      expect(pass).to.not.reportError("start = a:(a:'a')")
    })

    it("doesn't report labels duplicate with labels of following elements", () => {
      expect(pass).to.not.reportError("start = (a:'a') a:'a'")
    })
  })
})
