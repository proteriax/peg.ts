export default {
  comments: false,
  compact: false,
  presets: [["@babel/preset-typescript", { loose: true }]],
  plugins: [
    "@babel/plugin-proposal-export-namespace-from",
    "@babel/plugin-proposal-optional-chaining",
    "@babel/plugin-proposal-nullish-coalescing-operator",
    "@babel/plugin-proposal-class-properties",
    "babel-plugin-minify-dead-code-elimination",
  ],
}
