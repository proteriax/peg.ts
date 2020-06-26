const defaultEnd = /*html*/ `
    <footer id="footer">
      Copyright &copy; 2017+ <a href="https://futagoza.github.io/">Futago-za Ryuu</a>
      &bull;
      <a href="https://github.com/pegjs/pegjs">Source code</a>
      &bull;
      <a href="https://twitter.com/pegjs" title="Follow PEG.js on Twitter">Twitter</a>
      <br />
      Copyright &copy; 2010&ndash;2016 <a href="https://majda.cz/">David Majda</a>
    </footer>
  </div>
`

function menuItem(title: string | null, url: string, text: string) {
  const className = title === text ? ' class="current"' : ""

  return `<a ${className} href="/${url}">${text}</a>`
}

export interface HTMLOptions {
  bodyStart?: string
  bodyEnd?: string
  template?: string
  ga?: string
  head?: string
  layout?: string
  title?: string | null
}

const getTitle = (title: string | null) =>
  title && title !== "Home" ? `${title} &raquo; ` : ""

export default ({
  bodyStart = /*html*/ `<div id="main">`,
  bodyEnd = `    ${defaultEnd.trimLeft()}`,
  template: content = "",
  ga = "UA-100728112-1",
  head = "",
  layout = "default",
  title = null,
}: HTMLOptions = {}) =>
  /*html*/ `
  <!DOCTYPE html>
  <html>

  <head>
    <meta charset="utf-8">
    <meta name="author" content="Futago-za Ryuu (futagoza.ryuu@gmail.com)">
    <meta name="copyright" content="Copyright &copy; 2017 Futago-za Ryuu">
    <meta name="keywords" content="parser generator, PEG, JavaScript">
    <meta name="description" content="PEG.js is a parser generator for JavaScript based on the parsing expression grammar formalism.">
    <title>${getTitle(title)}PEG.js &ndash; Parser Generator for JavaScript</title>
    <link rel="stylesheet" href="/css/common.css">
    <link rel="stylesheet" href="/css/layout-${layout}.css">
    <link rel="stylesheet" href="/css/content.css">
    <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
    ${head}
  </head>

  <body>
    ${bodyStart}
      <header id="header">
        <h1><a href="/">PEG.js</a></h1>
        <h2>Parser Generator for JavaScript</h2>
      </header>

      <nav id="menu">
        ${menuItem(title, "", "Home")}
        ${menuItem(title, "online", "Online Version")}
        ${menuItem(title, "documentation", "Documentation")}
        ${menuItem(title, "development", "Development")}
      </nav>

      ${content.trim()}
    ${bodyEnd}
    <script type="text/javascript">
        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
        (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
        m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
        ga('create', '${ga}', 'auto');
        ga('send', 'pageview');
    </script>
  </body>
  </html>
`.trim()
