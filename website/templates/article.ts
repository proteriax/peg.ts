import template, { HTMLOptions } from "./html"

export default ({ template: content, ga, layout, title }: HTMLOptions = {}) => {
  return template({
    ga,
    layout,
    title,
    template: `
      <div id="content">
        ${content}
      </div>
    `,
  })
}
