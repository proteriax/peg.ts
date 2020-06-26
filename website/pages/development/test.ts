"use strict"

import { Bundler, expand } from "../../export.utils"
import template from "../../templates/article"

export default Bundler.create({
  script: __filename,
  check: expand("test"),
  config: {
    entry: expand("test/browser.stub.js"),
    library: ["peg", "test"],
    output: expand("public/js/test-bundle.min.js"),
  },

  next() {
    return template({
      title: "Test",
      template: `
        <div id="mocha"></div>
        <link href="/css/test.css" rel="stylesheet" />
        <script src='/js/test-bundle.min.js'></script>
    `,
    })
  },
})
