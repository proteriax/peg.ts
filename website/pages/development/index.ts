"use strict"

import template from "../../templates/article"

export default template({
  title: "Development",
  template: `

    <h1>Development</h1>

    <ul>
      <li><a href="https://github.com/pegjs/pegjs/wiki">Wiki</a></li>
      <li><a href="https://github.com/pegjs/pegjs">Source code</a></li>
      <li><a href="/development/benchmark">Benchmark Suite</a></li>
      <li><a href="/development/test">Test Suite</a></li>
      <li><a href="/development/try">Try Development Version online</a></li>
      <li><a href="https://github.com/pegjs/pegjs/issues">Issue tracker</a></li>
      <li><a href="https://groups.google.com/group/pegjs">Google Group</a></li>
      <li><a href="https://twitter.com/pegjs">Twitter</a></li>
    </ul>

    <p>PEG.js is currently maintained by <a href="https://github.com/futagoza">Futago-za Ryuu</a>.
    Since it's <a href="https://www.google.com/search?q=inception&plus;meaning">inception</a> in 2010, PEG.js was
    maintained by <a href="https://majda.cz/">David Majda</a> (<a href="https://twitter.com/dmajda">@dmajda</a>),
    until <a href="https://github.com/pegjs/pegjs/issues/503">May 2017</a>.</p>

    <p>The <a href="https://github.com/pegjs/bower">Bower package</a> is maintained by
    <a href="https://www.michel-kraemer.com/">Michel Krämer</a>
    (<a href="https://twitter.com/michelkraemer">@michelkraemer</a>).</p>

    <p>You are welcome to contribute code. Unless your contribution is really
    trivial you should get in touch with me first &mdash; this can prevent wasted
    effort on both sides. You can send code both as a patch or a GitHub pull
    request.</p>

    <p>Note that PEG.js is still very much work in progress. There are no
    compatibility guarantees until version 1.0.</p>

    `,
})
