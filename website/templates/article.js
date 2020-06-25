"use strict"

import template from "./html";

export default ({ content, ga, layout, title } = {}) => {
  content = `

        <div id="content">

            ${content}

        </div>

    `

  return template({ content, ga, layout, title })
};
