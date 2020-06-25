"use strict"

import ast from "../ast";
import GrammarError from "../grammar-error";
import opcodes from "./opcodes";
import parser from "../parser";
import vm from "../util/vm";

function fatal(message, location) {
  if (typeof location !== "undefined") throw new GrammarError(message, location)

  throw new Error(message)
}

class Session {
  constructor(config = {}) {
    this.opcodes = config.opcodes || opcodes
    this.parser = config.parser || parser
    this.passes = config.passes || {}
    this.visitor = config.visitor || ast.visitor
    this.vm = config.vm || vm

    if (typeof config.warn === "function") this.warn = config.warn
    if (typeof config.error === "function") this.error = config.error

    Object.defineProperty(this, "fatal", { value: fatal })
  }

  parse(input, options) {
    return this.parser.parse(input, options)
  }

  buildVisitor(functions) {
    return this.visitor.build(functions)
  }

  warn(_message, _location) {}

  error(message, location) {
    fatal(message, location)
  }
}

export default Session;
