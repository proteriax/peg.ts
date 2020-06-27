import { isFunction } from "lodash"
import type { API, SourceLocation, IOptions } from "../../typings/generated-parser"
import type { IVisitorMap, IVisitor } from "../ast/visitor"
import { Grammar } from "../ast/Grammar"
import { GrammarError } from "../grammar-error"
import { ICompilerPassOptions } from "./mod"
import * as visitor from "../ast/visitor"
import { opcodes } from "./opcodes"
import * as parser from "../parser"
import { evalModule } from "../util/vm"

function fatal(message: string, location?: SourceLocation) {
  if (location != null) {
    throw new GrammarError(message, location)
  }

  throw new Error(message)
}

export type ICompilerPass = (
  node: Grammar,
  session: Session,
  options: ICompilerPassOptions
) => void

type Enum = {
  [name: string]: number
} & {
  [name: number]: string
}

export interface IPassesMap {
  [type: string]: ICompilerPass[]
}

interface ISessionMessageEmitter {
  (message: string, location: SourceLocation): any
}

interface ISessionConfig {
  [key: string]: any
  opcodes?: Enum
  parser?: API<Grammar>
  passes?: IPassesMap
  visitor?: typeof visitor
  vm?: { evalModule: typeof evalModule }
  warn?: ISessionMessageEmitter
  error?: ISessionMessageEmitter
}

export interface ParserOptions extends IOptions {
  extractComments?: boolean
  reservedWords?: string[]
}

export interface Session extends Required<ISessionConfig> {}

export class Session implements ISessionConfig {
  fatal = fatal
  constructor(config: ISessionConfig = {}) {
    this.opcodes = config.opcodes ?? (opcodes as any)
    this.parser = config.parser ?? (parser as todo)
    this.passes = config.passes ?? {}
    this.visitor = config.visitor ?? visitor
    this.vm = config.vm ?? { evalModule }

    if (isFunction(config.warn)) this.warn = config.warn
    if (isFunction(config.error)) this.error = config.error
  }

  parse(input: string, options?: ParserOptions) {
    return this.parser.parse(input, options)
  }

  buildVisitor<T = void>(functions: IVisitorMap<T>): IVisitor<T> {
    return this.visitor.build(functions)
  }

  warn(_message: string, _location?: SourceLocation) {}

  error(message: string, location?: SourceLocation) {
    fatal(message, location)
  }
}
