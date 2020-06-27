export default {
  comments: false,
  compact: false,
  presets: [],
  plugins: [
    ["@babel/plugin-transform-typescript", { loose: true, allowDeclareFields: true }],
    "@babel/plugin-proposal-export-namespace-from",
    "@babel/plugin-proposal-optional-chaining",
    ["@babel/plugin-proposal-nullish-coalescing-operator", { loose: true }],
    ["@babel/plugin-proposal-class-properties", { loose: true }],
    "babel-plugin-transform-node-env-inline",
    "babel-plugin-minify-dead-code-elimination",
  ],
}
