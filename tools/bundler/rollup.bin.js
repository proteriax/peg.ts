import { string } from "rollup-plugin-string"
import babel from "@rollup/plugin-babel"
import node from "@rollup/plugin-node-resolve"
import prettier from "rollup-plugin-prettier"
import json from "@rollup/plugin-json"
import alias from "@rollup/plugin-alias"
import { builtinModules } from "module"
import shebang from "rollup-plugin-preserve-shebang"

import babelConfig from "./babel.config"
import { banner } from "./banner"

const extensions = [".js", ".ts"]

export default {
  input: require.resolve("@pegjs/main/lib/bin/bin.ts"),
  output: {
    file: "packages/pegjs/dist/bin.js",
    format: "cjs",
    banner,
  },
  external: x => x.startsWith("..") || builtinModules.concat("lodash").includes(x),
  plugins: [
    shebang(),
    alias({
      entries: { "@pegjs/main": "../dist/peg.cjs" },
    }),
    babel({ extensions, babelHelpers: "bundled", ...babelConfig }),
    prettier({ parser: "babel" }),
    json(),
    node({ extensions }),
    string({
      include: "**/*.txt",
    }),
  ],
}
