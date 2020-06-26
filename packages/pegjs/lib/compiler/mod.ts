import { forEach } from "lodash"
import { calcReportFailures } from "./passes/calc-report-failures"
import { generateBytecode } from "./passes/generate-bytecode"
import { generateJS } from "./passes/generate-js"
import { removeProxyRules } from "./passes/remove-proxy-rules"
import { reportDuplicateLabels } from "./passes/report-duplicate-labels"
import { reportDuplicateRules } from "./passes/report-duplicate-rules"
import { reportUnusedRules } from "./passes/report-unused-rules"
import { reportInfiniteRecursion } from "./passes/report-infinite-recursion"
import { reportInfiniteRepetition } from "./passes/report-infinite-repetition"
import { reportUndefinedRules } from "./passes/report-undefined-rules"
import { inferenceMatchResult } from "./passes/inference-match-result"
import { reportIncorrectPlucking } from "./passes/report-incorrect-plucking"
import { Grammar } from "../ast/Grammar"
import type { Session } from "./session"
import { IStageMap } from "../util/mod"
export { opcodes } from "./opcodes"

export { Session } from "./session"

export type FormatOptions = "commonjs" | "es"
export type OptimizeOptions = "size" | "speed"
export type OutputOptions = "parser" | "source"

export interface ICompilerOptions<T = OutputOptions> {
  [key: string]: any
  allowedStartRules?: string[]
  cache?: boolean
  context?: { [name: string]: any }
  dependencies?: { [name: string]: string }
  exportVar?: string
  features?: IGeneratedParserFeatures
  format?: FormatOptions
  header?: string | string[]
  optimize?: OptimizeOptions
  output?: T
  prettier?: boolean
  trace?: boolean
}

export interface ICompilerPassOptions extends ICompilerOptions {
  allowedStartRules: string[]
  cache: boolean
  context: { [name: string]: any }
  dependencies: { [name: string]: string }
  exportVar: string
  features: IGeneratedParserFeatures
  format: FormatOptions
  header: string | string[]
  optimize: OptimizeOptions
  output: OutputOptions
  trace: boolean
}

interface IGeneratedParserFeatures {
  [key: string]: boolean
  text: boolean
  offset: boolean
  range: boolean
  location: boolean
  expected: boolean
  error: boolean
  filename: boolean
  DefaultTracer: boolean
}

// Compiler passes.
//
// Each pass is a function that is passed the AST. It can perform checks on it
// or modify it as needed. If the pass encounters a semantic error, it throws
// |peg.GrammarError|.
export const passes = {
  check: {
    reportUndefinedRules,
    reportDuplicateRules,
    reportUnusedRules,
    reportDuplicateLabels,
    reportInfiniteRecursion,
    reportInfiniteRepetition,
    reportIncorrectPlucking,
  },
  transform: {
    removeProxyRules,
  },
  generate: {
    calcReportFailures,
    inferenceMatchResult,
    generateBytecode,
    generateJS,
  },
}

if (false) {
  // Type check
  ;[passes as IStageMap]
}

// Generates a parser from a specified grammar AST. Throws |peg.GrammarError|
// if the AST contains a semantic error. Note that not all errors are detected
// during the generation and some may protrude to the generated parser and
// cause its malfunction.
export function compile(ast: Grammar, session: Session, options: ICompilerOptions = {}) {
  options = {
    allowedStartRules: [ast.rules[0].name],
    cache: false,
    context: {},
    dependencies: {},
    format: "commonjs",
    optimize: "speed",
    output: "parser",
    trace: false,
    prettier: false,
    ...options,
  }

  // We want `session.vm.evalModule` to return the parser
  if (options.output === "parser") {
    options.format = "commonjs"
  }

  forEach(session.passes, stage => {
    stage.forEach(pass => {
      pass(ast, session, options as Required<ICompilerOptions>)
    })
  })

  let code = ast.code!

  switch (options.output) {
    case "parser": {
      const js = code // transpile(ast.code!)
      return session.vm.evalModule(js, options.context)
    }
    case "source": {
      if (options.prettier) {
        const prettier = require("prettier")
        code = prettier.format(code, { parser: "babel", arrowParens: "avoid" })
      }
      return code
    }
    default:
      session.error(`Invalid output format: ${options.output}.`)
  }
}
