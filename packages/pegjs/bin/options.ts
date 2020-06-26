import * as fs from "fs"
import * as path from "path"
import * as peg from "../dist/peg.cjs"
import { isString, isObject } from "lodash"
import { IBuildOptions } from "../lib/mod"
import { FormatOptions, OptimizeOptions } from "../lib/compiler/mod"

// Options

let inputFile: string | null = null
let outputFile: string | null = null
let options = {
  "--": [],
  cache: false,
  dependencies: {},
  format: "commonjs",
  optimize: "speed",
  output: "source",
  parser: {},
  plugins: [],
  trace: false,
  prettier: false,
} as IBuildOptions

const EXPORT_VAR_FORMATS = ["globals", "umd"]
const MODULE_FORMATS = ["commonjs", "es"]
const OPTIMIZATION_GOALS = ["size", "speed"]

// Helpers

function abort(message: string): never {
  console.trace()
  console.error(message)
  process.exit(1)
}

function addExtraOptions(config: string | IBuildOptions) {
  if (isString(config)) {
    try {
      config = JSON.parse(config) as IBuildOptions
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e
      abort(`Error parsing JSON: ${e.message}`)
    }
  }

  if (!isObject(config)) {
    abort("The JSON with extra options has to represent an object.")
  }

  if (config.input !== null || config.output !== null) {
    // We don't want to touch the original config, just in case it comes from
    // a javascript file, in which case its possible the same object is used
    // for something else, somewhere else.
    config = { ...config }
    const { input, output } = config

    if (input !== null) {
      if (!isString(input)) {
        abort("The option `input` must be a string.")
      }

      if (inputFile !== null) {
        abort(`The input file is already set, cannot use: "${input}".`)
      }

      inputFile = input
      delete config.input
    }

    if (output !== null) {
      if (!isString(output)) {
        abort("The option `output` must be a string.")
      }

      outputFile = output
      delete config.output
    }
  }

  options = { ...options, ...config }
}

function formatChoicesList(list: string[]) {
  list = list.map(entry => `"${entry}"`)
  const lastOption = list.pop()

  return list.length === 0 ? lastOption : `${list.join(", ")} or ${lastOption}`
}

function updateList(list: string[], string: string) {
  string.split(",").forEach(entry => {
    entry = entry.trim()
    if (!list.includes(entry)) {
      list.push(entry)
    }
  })
}

// Arguments

let args: (string | string[])[] = process.argv.slice(2)

function nextArg(option: string) {
  if (args.length === 0) {
    abort(`Missing parameter of the ${option} option.`)
  }
  console.assert(typeof args[0] === "string")
  return args.shift()! as string
}

// Parse Arguments

while (args.length > 0) {
  let config
  let argument = args.shift()! as string

  if (argument.startsWith("-") && argument.indexOf("=") > 1) {
    const list = argument.split("=")
    args.unshift(list.length > 2 ? list.slice(1) : list[1])
    argument = list[0]
  }

  switch (argument) {
    case "--":
      options["--"] = args
      args = []
      break

    case "-a":
    case "--allowed-start-rules":
      if (!options.allowedStartRules) {
        options.allowedStartRules = []
      }
      updateList(options.allowedStartRules, nextArg("--allowed-start-rules"))
      break

    case "--cache":
      options.cache = true
      break

    case "--no-cache":
      options.cache = false
      break

    case "-d":
    case "--dependency": {
      argument = nextArg("-d/--dependency")
      const mod = argument.split(":")
      options.dependencies![mod[0]] = mod[1] ?? mod[0]
      break
    }
    case "-e":
    case "--export-var":
      options.exportVar = nextArg("-e/--export-var")
      break

    case "--extra-options":
      addExtraOptions(nextArg("--extra-options"))
      break

    case "-c":
    case "--config":
    case "--extra-options-file":
      argument = nextArg("-c/--config/--extra-options-file")
      if ([".js", ".ts"].includes(path.extname(argument))) {
        config = require(path.resolve(argument))
      } else {
        try {
          config = fs.readFileSync(argument, "utf8")
        } catch (e) {
          abort(`Can't read from file "${argument}".`)
        }
      }
      if ("default" in config) {
        config = config.default
      }
      addExtraOptions(config)
      break

    case "-f":
    case "--format":
      argument = nextArg("-f/--format")
      if (!MODULE_FORMATS.includes(argument)) {
        abort(`Module format must be either ${formatChoicesList(MODULE_FORMATS)}.`)
      }
      options.format = argument as FormatOptions
      break

    case "-h":
    case "--help":
      console.log(fs.readFileSync("./usage.txt", "utf8"))
      process.exit()
      break

    case "-O":
    case "--optimize":
      argument = nextArg("-O/--optimize")
      if (!OPTIMIZATION_GOALS.includes(argument)) {
        abort(
          `Optimization goal must be either ${formatChoicesList(OPTIMIZATION_GOALS)}.`
        )
      }
      options.optimize = argument as OptimizeOptions
      break

    case "-o":
    case "--output":
      outputFile = nextArg("-o/--output")
      break

    case "-p":
    case "--plugin": {
      argument = nextArg("-p/--plugin")
      let mod: any
      try {
        mod = require(argument)
      } catch (ex1) {
        if (ex1.code !== "MODULE_NOT_FOUND") {
          throw ex1
        }
        try {
          mod = require(path.resolve(argument))
        } catch (ex2) {
          if (ex2.code !== "MODULE_NOT_FOUND") {
            throw ex2
          }
          abort(`Can't load module "${argument}".`)
        }
      }
      options.plugins!.push(mod)
      break
    }

    case "--trace":
      options.trace = true
      break

    case "--no-trace":
      options.trace = false
      break

    case "-v":
    case "--version":
      console.log(`PEG.js v${peg.VERSION}`)
      process.exit()

    default:
      if (inputFile !== null) {
        abort(`Unknown option: "${argument}".`)
      }
      inputFile = argument
  }
}

// Validation and defaults

if (options.exportVar) {
  if (!EXPORT_VAR_FORMATS.includes(options.format!)) {
    abort(
      `Can't use the -e/--export-var option with the "${options.format}" module format.`
    )
  }
}

if (inputFile === null) {
  inputFile = "-"
}

if (outputFile === null) {
  if (inputFile === "-") {
    outputFile = "-"
  } else if (inputFile) {
    outputFile = `${inputFile.substr(
      0,
      inputFile.length - path.extname(inputFile).length
    )}.js`
  }
}

// Export

options.inputFile = inputFile
options.outputFile = outputFile

export default options
