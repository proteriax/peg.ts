import babel from "@rollup/plugin-babel"
import node from "@rollup/plugin-node-resolve"
import prettier from "rollup-plugin-prettier"
import json from "@rollup/plugin-json"
import alias from "@rollup/plugin-alias"
import { merge } from "lodash"

import babelConfig from "./babel.config"
import { version } from "pegjs/package.json"

const extensions = [".js", ".ts"]

const createConfig = ({ plugins = [], external, ...config }) =>
  merge(
    {
      input: require.resolve("pegjs"),
      output: {
        banner: `
          /**
           * PEG.js v${version}
           * https://pegjs.org/
           *
           * Copyright (c) 2010-2016 David Majda
           * Copyright (c) 2017+ Futago-za Ryuu
           *
           * Released under the MIT License.
           */

          /* eslint-disable */
        `,
      },
      external: x => x.startsWith("https:") || external.includes(x),
      plugins: [
        ...plugins,
        babel({ extensions, babelHelpers: "bundled", ...babelConfig }),
        prettier({ parser: "babel" }),
        json(),
        node({ extensions }),
      ],
    },
    config
  )

export default [
  createConfig({
    external: ["jsesc"],
    output: {
      file: "packages/pegjs/dist/peg.js",
      format: "es",
    },
    plugins: [
      alias({
        entries: {
          lodash: "https://unpkg.com/lodash-es@4.17.15/lodash.js",
        },
      }),
    ],
  }),
  createConfig({
    external: ["lodash", "jsesc"],
    output: {
      file: "packages/pegjs/dist/peg.cjs.js",
      format: "cjs",
    },
  }),
]
