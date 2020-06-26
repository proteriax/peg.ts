import { API } from "../typings/generated-parser"

export { GrammarError } from "./grammar-error"
export * as ast from "./ast/mod"
import * as compiler from "./compiler/mod"
export * as util from "./util/mod"
export { default as parser } from "./parser"
import { convertPasses } from "./util/mod"

import { version } from "../package.json"
import { ParserOptions, Session } from "./compiler/session"

// PEG.js version (uses semantic versioning).
export { version as VERSION, compiler }

type PluginUse<T = compiler.OutputOptions> = (
  session: Session,
  options: IBuildOptions<T>
) => void

interface IPlugin<T = compiler.OutputOptions> {
  [key: string]: any
  use: PluginUse<T>
}

export interface IBuildOptions<T = compiler.OutputOptions>
  extends compiler.ICompilerOptions<T> {
  plugins?: (IPlugin<T> | PluginUse<T>)[]
  parser?: ParserOptions
}

/**
 * Generates a parser from the PEG.js grammar and returns it.
 */
export function generate(grammar: string): API

/**
 * Generates a parser from the PEG.js grammar and returns it.
 */
export function generate(
  grammar: string,
  options?: IBuildOptions & { output: "source" }
): string

export function generate(grammar: string, options?: IBuildOptions): API

/**
 * Generates a parser from the PEG.js grammar, then evaluates the source before returning the parser object.
 */
export function generate(grammar: string, options?: IBuildOptions<"parser">): API

/**
 * Generates a parser from the PEG.js grammar and returns the JavaScript based source.
 */
export function generate(grammar: string, options?: IBuildOptions<"source">): string

// Generates a parser from a specified grammar and returns it.
//
// The grammar must be a string in the format described by the meta-grammar in
// the parser.pegjs file.
//
// Throws |peg.parser.SyntaxError| if the grammar contains a syntax error or
// |peg.GrammarError| if it contains a semantic error. Note that not all
// errors are detected during the generation and some may protrude to the
// generated parser and cause its malfunction.
export function generate(grammar, options: IBuildOptions = {}) {
  const session = new Session({
    passes: convertPasses(compiler.passes),
  })

  if (Array.isArray(options.plugins)) {
    options.plugins.forEach(p => {
      const use = "use" in p ? p.use : p
      if (typeof use !== "function") return
      use.call(p, session, options)
    })
  }

  return compiler.compile(session.parse(grammar, options.parser ?? {}), session, options)
}
