"use strict";

import {Bundler, fs, expand} from "../../export.utils";
import template from "../../templates/editor";

export default Bundler.create( {

    script: __filename,
    check: expand( "packages" ),
    config: {

        entry: require.resolve( "pegjs" ),
        library: "peg",
        output: expand( "public/js/peg-bundle.min.js" ),

    },

    async next() {

        return template( {
            title: "Try Development Version",
            lib: "/js/peg-bundle.min.js",
            input: await fs.readFile( expand( "examples/arithmetics.pegjs" ), "utf8" ),
        } );

    },

} );
