import { util } from "@pegjs/main"
import { expect } from "chai"
import type { IPassesMap } from "@pegjs/main/lib/compiler/session"

const { convertPasses } = util

describe("PEG.js Utility API", () => {
  describe("util.convertPasses", () => {
    const passes = {
      stage1: {
        pass1() {},
        pass2() {},
        pass3() {},
      },
      stage2: {
        pass1() {},
        pass2() {},
      },
      stage3: {
        pass1() {},
      },
    }

    function expectPasses(result: IPassesMap) {
      expect(result).to.be.an("object")
      expect(result.stage1).to.be.an("array").and.to.have.lengthOf(3)
      expect(result.stage2).to.be.an("array").and.to.have.lengthOf(2)
      expect(result.stage3).to.be.an("array").and.to.have.lengthOf(1)
    }

    it("converts a map of stages containing a map of passes", () => {
      expectPasses(convertPasses(passes))
    })

    it("converts a map of stages containing a list of passes", () => {
      expectPasses(
        convertPasses({
          stage1: [passes.stage1.pass1, passes.stage1.pass2, passes.stage1.pass3],
          stage2: passes.stage2,
          stage3: [passes.stage3.pass1],
        })
      )
    })
  })
})
