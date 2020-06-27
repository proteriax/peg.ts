#!/usr/bin/env node

/**
 * PEG.js v0.11.0
 * https://pegjs.org/
 *
 * Copyright (c) 2010-2016 David Majda
 * Copyright (c) 2017+ Futago-za Ryuu
 * Copyright (c) 2020+ proteriax
 *
 * Released under the MIT License.
 */

/* eslint-disable */

"use strict"

var fs = require("fs")
var peg = require("../dist/peg.cjs")
var path = require("path")
var lodash = require("lodash")

let inputFile = null
let outputFile = null
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
}
const EXPORT_VAR_FORMATS = ["globals", "umd"]
const MODULE_FORMATS = ["commonjs", "es"]
const OPTIMIZATION_GOALS = ["size", "speed"]

function abort(message) {
  console.trace()
  console.error(message)
  process.exit(1)
}

function addExtraOptions(config) {
  if (lodash.isString(config)) {
    try {
      config = JSON.parse(config)
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e
      abort(`Error parsing JSON: ${e.message}`)
    }
  }

  if (!lodash.isObject(config)) {
    abort("The JSON with extra options has to represent an object.")
  }

  if (config.input !== null || config.output !== null) {
    config = { ...config }
    const { input, output } = config

    if (input !== null) {
      if (!lodash.isString(input)) {
        abort("The option `input` must be a string.")
      }

      if (inputFile !== null) {
        abort(`The input file is already set, cannot use: "${input}".`)
      }

      inputFile = input
      delete config.input
    }

    if (output !== null) {
      if (!lodash.isString(output)) {
        abort("The option `output` must be a string.")
      }

      outputFile = output
      delete config.output
    }
  }

  options = { ...options, ...config }
}

function formatChoicesList(list) {
  list = list.map(entry => `"${entry}"`)
  const lastOption = list.pop()
  return list.length === 0 ? lastOption : `${list.join(", ")} or ${lastOption}`
}

function updateList(list, string) {
  string.split(",").forEach(entry => {
    entry = entry.trim()

    if (!list.includes(entry)) {
      list.push(entry)
    }
  })
}

let args = process.argv.slice(2)

function nextArg(option) {
  if (args.length === 0) {
    abort(`Missing parameter of the ${option} option.`)
  }

  console.assert(typeof args[0] === "string")
  return args.shift()
}

while (args.length > 0) {
  let config
  let argument = args.shift()

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
      var _mod$

      argument = nextArg("-d/--dependency")
      const mod = argument.split(":")
      options.dependencies[mod[0]] = (_mod$ = mod[1]) != null ? _mod$ : mod[0]
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

      if ([".js", ".ts", ".json"].includes(path.extname(argument))) {
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

      options.format = argument
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

      options.optimize = argument
      break

    case "-o":
    case "--output":
      outputFile = nextArg("-o/--output")
      break

    case "-p":
    case "--plugin": {
      argument = nextArg("-p/--plugin")
      let mod

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

      options.plugins.push(mod)
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

if (options.exportVar) {
  if (!EXPORT_VAR_FORMATS.includes(options.format)) {
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

options.inputFile = inputFile
options.outputFile = outputFile
var options$1 = options

const readStream = inputStream =>
  new Promise(resolve => {
    let input = ""
    inputStream.on("data", data => (input += data))
    inputStream.on("end", () => resolve(input))
  })

function closeStream(stream) {
  if (stream !== process.stdout) {
    stream.end()
  }
}

function abort$1(message) {
  console.trace()
  console.error(message)
  process.exit(1)
}

function main() {
  let inputStream
  let outputStream
  let originalContent
  const inputFile = options$1.inputFile
  const outputFile = options$1.outputFile
  options$1.parser = options$1.parser || {}

  if (inputFile === "-") {
    process.stdin.resume()
    inputStream = process.stdin
    inputStream.on("error", () => {
      abort$1(`Can't read from file "${inputFile}".`)
    })
  } else {
    inputStream = fs.createReadStream(inputFile)
    options$1.parser.filename = inputFile
  }

  if (outputFile === "-") {
    outputStream = process.stdout
  } else {
    if (fs.existsSync(outputFile)) {
      originalContent = fs.readFileSync(outputFile, "utf8")
    }

    outputStream = fs.createWriteStream(outputFile)
    outputStream.on("error", () => {
      abort$1(`Can't write to file "${outputFile}".`)
    })
  }

  readStream(inputStream).then(input => {
    let location
    let source

    try {
      source = peg.generate(input, options$1)
    } catch (e) {
      if (typeof e.location === "object") {
        location = e.location.start

        if (typeof location === "object") {
          return abort$1(`${location.line}:${location.column}: ${e.message}`)
        }
      }

      if (originalContent) {
        closeStream(outputStream)
        fs.writeFileSync(outputFile, originalContent, "utf8")
      }

      console.error(e)
      return abort$1(e.message)
    }

    outputStream.write(source)
    closeStream(outputStream)
  })
}

main()
