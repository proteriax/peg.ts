"use strict";

import {fs, expand} from "../export.utils";
import template from "../templates/article";

export default async () => template( {
    title: "Documentation",
    content: await fs.readFile( expand( "documentation.html", __dirname ), "utf8" ),
} );
