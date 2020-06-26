import "./useHelpers"
import { expect } from "chai"
import { compiler } from "pegjs"

const pass = compiler.passes.check.reportIncorrectPlucking

describe("compiler pass |reportIncorrectPlucking|", () => {
  function reports(error, edgeCases) {
    it(error.slice(0, -1), () => {
      edgeCases.forEach(grammar => expect(pass).to.reportError(grammar, error))
    })
  }

  reports(`"@" cannot be used with an action block.`, [
    `start1 = 'a' @'b' 'c' { /* empty action block */ }`,
    `start2 = 'a' @('b' @'c' { /* empty action block */ })`,
  ])

  reports(`"@" cannot be used on a semantic predicate.`, [
    `start1 = 'a' @&{ /* semantic_and */ } 'c'`,
    `start2 = 'a' @!{ /* semantic_not */ } 'c'`,
  ])

  it("allows valid plucking", function () {
    expect(pass).not.to.reportError(`
      start1 =  @'1'               // return '1'
      start2 =  @'1' / @'2'        // return '1' or '2'
      start2 =   '1'   @'2' '3'    // return '2'
      start3 =   '1' @b:'2' '3'    // return '2', label "b" can be used in semantic predicates
      start4 = a:'1' @b:'2' '3'    // return '2', labels "a" and "b" can be used in semantic predicates
      start5 =  @'1'   @'2' '3'    // return ['1', '2']
      start6 =  @'1' @b:'2' '3'    // return ['1', '2'], label "b" can be used in semantic predicates
      start7 = a:'1'   @'2' &{}    // return '2' if the semantic predicate doesnt fail
    `)
  })
})
