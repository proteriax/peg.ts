import "./useHelpers"
import { expect } from "chai"
import { compiler } from "pegjs"

const pass = compiler.passes.check.reportUnusedRules

describe("compiler pass |reportUnusedRules|", () => {
  it("should report rules that are not referenced", () => {
    expect(pass).to.reportWarning(
      `
          start = .
          unused = .
      `,
      `Rule "unused" is not referenced.`
    )

    expect(pass).to.reportWarning(
      `
          start = .
          unused = .
          used = .
      `,
      [`Rule "used" is not referenced.`, `Rule "unused" is not referenced.`]
    )
  })

  it("does not report rules that are referenced", () => {
    expect(pass).not.to.reportWarning(`start = .`)

    expect(pass).not.to.reportWarning(`
      start = used
      used = .
    `)
  })

  it("does not report any rules that the generated parser starts parsing from", () => {
    expect(pass).not.to.reportWarning(
      `
        a = "x"
        b = a
        c = .+
      `,
      [],
      {
        allowedStartRules: ["b", "c"],
      }
    )
  })
})
