/**
 * `eval` the given source as a CommonJS module, using properties found in `context` as top-level variables.
 *
 * Based on `vm.runInContext` found in Node.js, this is a cross-env solution.
 */
export function evalModule(source: string, context: { [key: string]: any }) {
  const argumentKeys = Object.keys(context)
  const argumentValues = Object.values(context)

  const module = { exports: {} }
  argumentKeys.push("module", "exports", source)
  argumentValues.push(module, module.exports)

  Function(...argumentKeys)(...argumentValues)

  return module.exports
}

// Exports
