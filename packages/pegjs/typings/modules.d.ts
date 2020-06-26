/// <reference path="./api.d.ts" />

declare module "_pegjs" {
  export default peg
}

declare module "_pegjs/lib/grammar-error" {
  export default peg.GrammarError
}

declare module "_pegjs/lib/parser" {
  export default peg.parser
}

declare module "_pegjs/lib/peg" {
  export default peg
}

declare module "_pegjs/lib/ast" {
  export default peg.ast
}

declare module "_pegjs/lib/ast/Grammar" {
  export default peg.ast.Grammar
}

declare module "_pegjs/lib/ast/Node" {
  export default peg.ast.Node
}

declare module "_pegjs/lib/ast/visitor" {
  export default peg.ast.visitor
}

declare module "_pegjs/lib/compiler" {
  export default peg.compiler
}

declare module "_pegjs/lib/compiler/index" {
  export default peg.compiler
}

declare module "_pegjs/lib/compiler/opcodes" {
  const opcodes: peg.compiler.IOpcodes
  export default opcodes
}

declare module "_pegjs/lib/compiler/session" {
  export default peg.compiler.Session
}

declare module "_pegjs/lib/compiler/passes/calc-report-failures" {
  export default peg.compiler.passes.generate.calcReportFailures
}

declare module "_pegjs/lib/compiler/passes/generate-bytecode" {
  export default peg.compiler.passes.generate.generateBytecode
}

declare module "_pegjs/lib/compiler/passes/generate-js" {
  export default peg.compiler.passes.generate.generateJS
}

declare module "_pegjs/lib/compiler/passes/inference-match-result" {
  export default peg.compiler.passes.generate.inferenceMatchResult
}

declare module "_pegjs/lib/compiler/passes/remove-proxy-rules" {
  export default peg.compiler.passes.transform.removeProxyRules
}

declare module "_pegjs/lib/compiler/passes/report-duplicate-labels" {
  export default peg.compiler.passes.check.reportDuplicateLabels
}

declare module "_pegjs/lib/compiler/passes/report-duplicate-rules" {
  export default peg.compiler.passes.check.reportDuplicateRules
}

declare module "_pegjs/lib/compiler/passes/report-incorrect-plucking" {
  export default peg.compiler.passes.check.reportIncorrectPlucking
}

declare module "_pegjs/lib/compiler/passes/report-infinite-recursion" {
  export default peg.compiler.passes.check.reportInfiniteRecursion
}

declare module "_pegjs/lib/compiler/passes/report-infinite-repetition" {
  export default peg.compiler.passes.check.reportInfiniteRepetition
}

declare module "_pegjs/lib/compiler/passes/report-undefined-rules" {
  export default peg.compiler.passes.check.reportUndefinedRules
}

declare module "_pegjs/lib/compiler/passes/report-unused-rules" {
  export default peg.compiler.passes.check.reportUnusedRules
}

declare module "_pegjs/lib/util" {
  export default peg.util
}

declare module "_pegjs/lib/util/arrays" {
  const arrays: peg.IArrayUtils
  export default arrays
}

declare module "_pegjs/lib/util/index" {
  export default peg.util
}

declare module "_pegjs/lib/util/js" {
  const js: peg.IJavaScriptUtils
  export default js
}

declare module "_pegjs/lib/util/objects" {
  const objects: peg.IObjectUtils
  export default objects
}

declare module "_pegjs/lib/util/vm" {
  const vm: peg.compiler.ISessionVM
  export default vm
}
