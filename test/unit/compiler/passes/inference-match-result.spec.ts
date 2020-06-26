import "./useHelpers"
import { expect } from "chai"
import { compiler } from "pegjs"

const pass = compiler.passes.generate.inferenceMatchResult

describe("compiler pass |inferenceMatchResult|", () => {
  it("calculate |match| property for |any| correctly", () => {
    expect(pass).to.changeAST("start = .          ", { rules: [{ match: 0 }] }, {}, {})
  })

  it("calculate |match| property for |literal| correctly", () => {
    expect(pass).to.changeAST("start = ''         ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = ''i        ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = 'a'        ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = 'a'i       ", { rules: [{ match: 0 }] }, {}, {})
  })

  it("calculate |match| property for |class| correctly", () => {
    expect(pass).to.changeAST("start = []         ", { rules: [{ match: -1 }] }, {}, {})
    expect(pass).to.changeAST("start = []i        ", { rules: [{ match: -1 }] }, {}, {})
    expect(pass).to.changeAST("start = [a]        ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = [a]i       ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = [a-b]      ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = [a-b]i     ", { rules: [{ match: 0 }] }, {}, {})
  })

  it("calculate |match| property for |sequence| correctly", () => {
    expect(pass).to.changeAST("start = 'a' 'b'    ", { rules: [{ match: 0 }] }, {}, {})

    expect(pass).to.changeAST("start = 'a' ''     ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = '' 'b'     ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = '' ''      ", { rules: [{ match: 1 }] }, {}, {})

    expect(pass).to.changeAST("start = 'a' []     ", { rules: [{ match: -1 }] }, {}, {})
    expect(pass).to.changeAST("start = [] 'b'     ", { rules: [{ match: -1 }] }, {}, {})
    expect(pass).to.changeAST("start = [] []      ", { rules: [{ match: -1 }] }, {}, {})
  })

  it("calculate |match| property for |choice| correctly", () => {
    expect(pass).to.changeAST("start = 'a' / 'b'  ", { rules: [{ match: 0 }] }, {}, {})

    expect(pass).to.changeAST("start = 'a' / ''   ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = ''  / 'b'  ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = ''  / ''   ", { rules: [{ match: 1 }] }, {}, {})

    expect(pass).to.changeAST("start = 'a' / []   ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = []  / 'b'  ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = []  / []   ", { rules: [{ match: -1 }] }, {}, {})
  })

  it("calculate |match| property for predicates correctly", () => {
    expect(pass).to.changeAST("start = &.         ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = &''        ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = &[]        ", { rules: [{ match: -1 }] }, {}, {})

    expect(pass).to.changeAST("start = !.         ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = !''        ", { rules: [{ match: -1 }] }, {}, {})
    expect(pass).to.changeAST("start = ![]        ", { rules: [{ match: 1 }] }, {}, {})

    expect(pass).to.changeAST("start = &{ code }  ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = !{ code }  ", { rules: [{ match: 0 }] }, {}, {})
  })

  it("calculate |match| property for |text| correctly", () => {
    expect(pass).to.changeAST("start = $.         ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = $''        ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = $[]        ", { rules: [{ match: -1 }] }, {}, {})
  })

  it("calculate |match| property for |action| correctly", () => {
    expect(pass).to.changeAST("start = .  { code }", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = '' { code }", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = [] { code }", { rules: [{ match: -1 }] }, {}, {})
  })

  it("calculate |match| property for |labeled| correctly", () => {
    expect(pass).to.changeAST("start = a:.        ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = a:''       ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = a:[]       ", { rules: [{ match: -1 }] }, {}, {})
  })

  it("calculate |match| property for |named| correctly", () => {
    expect(pass).to.changeAST("start 'start' = .  ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start 'start' = '' ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start 'start' = [] ", { rules: [{ match: -1 }] }, {}, {})
  })

  it("calculate |match| property for |optional| correctly", () => {
    expect(pass).to.changeAST("start = .?         ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = ''?        ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = []?        ", { rules: [{ match: 1 }] }, {}, {})
  })

  it("calculate |match| property for |zero_or_more| correctly", () => {
    expect(pass).to.changeAST("start = .*         ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = ''*        ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = []*        ", { rules: [{ match: 1 }] }, {}, {})
  })

  it("calculate |match| property for |one_or_more| correctly", () => {
    expect(pass).to.changeAST("start = .+         ", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = ''+        ", { rules: [{ match: 1 }] }, {}, {})
    expect(pass).to.changeAST("start = []+        ", { rules: [{ match: -1 }] }, {}, {})
  })

  it("calculate |match| property for |rule_ref| correctly", () => {
    expect(pass).to.changeAST(
      ["start = end", "end = . "].join("\n"),
      { rules: [{ match: 0 }, { match: 0 }] },
      {},
      {}
    )
    expect(pass).to.changeAST(
      ["start = end", "end = ''"].join("\n"),
      { rules: [{ match: 1 }, { match: 1 }] },
      {},
      {}
    )
    expect(pass).to.changeAST(
      ["start = end", "end = []"].join("\n"),
      { rules: [{ match: -1 }, { match: -1 }] },
      {},
      {}
    )

    expect(pass).to.changeAST("start = .  start", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = '' start", { rules: [{ match: 0 }] }, {}, {})
    expect(pass).to.changeAST("start = [] start", { rules: [{ match: -1 }] }, {}, {})

    expect(pass).to.changeAST("start = . start []", { rules: [{ match: -1 }] }, {}, {})
  })
})
