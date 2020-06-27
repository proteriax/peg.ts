#!/usr/bin/env node
import * as fs from "fs"
import * as peg from "@pegjs/main"
import options from "./options"
import type { SourcePosition } from "../../typings/generated-parser"

// Helpers
const readStream = (inputStream: NodeJS.ReadableStream) =>
  new Promise<string>(resolve => {
    let input = ""
    inputStream.on("data", data => (input += data))
    inputStream.on("end", () => resolve(input))
  })

function closeStream(stream: NodeJS.WritableStream) {
  if (stream !== process.stdout) {
    stream.end()
  }
}

function abort(message: string) {
  console.trace()
  console.error(message)
  process.exit(1)
}

// Main
async function main() {
  let inputStream: NodeJS.ReadableStream
  let outputStream: NodeJS.WritableStream
  let originalContent: string

  const inputFile = options.inputFile
  const outputFile = options.outputFile
  options.parser = options.parser || {}

  if (inputFile === "-") {
    process.stdin.resume()
    inputStream = process.stdin
    inputStream.on("error", () => {
      abort(`Can't read from file "${inputFile}".`)
    })
  } else {
    inputStream = fs.createReadStream(inputFile)
    options.parser.filename = inputFile
  }

  if (outputFile === "-") {
    outputStream = process.stdout
  } else {
    if (fs.existsSync(outputFile)) {
      originalContent = fs.readFileSync(outputFile, "utf8")
    }

    outputStream = fs.createWriteStream(outputFile)
    outputStream.on("error", () => {
      abort(`Can't write to file "${outputFile}".`)
    })
  }

  const input = await readStream(inputStream)
  let location: SourcePosition
  let source: string

  try {
    source = peg.generate(input, { ...options, output: "source" })
  } catch (e) {
    if (typeof e.location === "object") {
      location = e.location.start
      if (typeof location === "object") {
        return abort(`${location.line}:${location.column}: ${e.message}`)
      }
    }

    if (originalContent!) {
      closeStream(outputStream)
      fs.writeFileSync(outputFile, originalContent!, "utf8")
    }

    console.error(e)
    return abort(e.message)
  }

  outputStream.write(source)
  closeStream(outputStream)
}

main().catch(console.error)
