export default {
  input: "src/parser.pegjs",
  output: "packages/pegjs/lib/parser.ts",

  header: "/* eslint-disable */",
  format: "es",

  dependencies: {
    ast: "./ast/mod",
    util: "./util/mod",
  },

  features: {
    offset: false,
    range: false,
    expected: false,
  },
}
