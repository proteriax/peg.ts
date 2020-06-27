/**
 * `eval` the given source as a CommonJS module, using properties found in `context` as top-level variables.
 *
 * Based on `vm.runInContext` found in Node.js, this is a cross-env solution.
 */
export function evalModule(source: string, context: { [key: string]: any } = {}) {
  const argumentKeys = Object.keys(context)
  const argumentValues = Object.values(context)

  const wrapped = `
    try {
      ${source}
    } catch (e) {
      console.trace();
      console.error(e);
      throw e;
    }`

  const module = { exports: {} }
  argumentKeys.push("module", "exports", "require", wrapped)
  argumentValues.push(module, module.exports, require)

  Function(...argumentKeys)(...argumentValues)

  return module.exports
}

// Exports
