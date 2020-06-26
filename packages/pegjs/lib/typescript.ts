import { transpileModule, ModuleKind } from "typescript"

export function transpile(ts: string) {
  return transpileModule(ts, {
    compilerOptions: {
      module: ModuleKind.CommonJS,
    },
  }).outputText
}
