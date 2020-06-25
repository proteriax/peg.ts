"use strict";

import calcReportFailures from "./passes/calc-report-failures";
import generateBytecode from "./passes/generate-bytecode";
import generateJS from "./passes/generate-js";
import removeProxyRules from "./passes/remove-proxy-rules";
import reportDuplicateLabels from "./passes/report-duplicate-labels";
import reportDuplicateRules from "./passes/report-duplicate-rules";
import reportUnusedRules from "./passes/report-unused-rules";
import reportInfiniteRecursion from "./passes/report-infinite-recursion";
import reportInfiniteRepetition from "./passes/report-infinite-repetition";
import reportUndefinedRules from "./passes/report-undefined-rules";
import inferenceMatchResult from "./passes/inference-match-result";
import reportIncorrectPlucking from "./passes/report-incorrect-plucking";
import Session from "./session";
import util from "../util";

const compiler = {

    Session,

    // Compiler passes.
    //
    // Each pass is a function that is passed the AST. It can perform checks on it
    // or modify it as needed. If the pass encounters a semantic error, it throws
    // |peg.GrammarError|.
    passes: {
        check: {
            reportUndefinedRules,
            reportDuplicateRules,
            reportUnusedRules,
            reportDuplicateLabels,
            reportInfiniteRecursion,
            reportInfiniteRepetition,
            reportIncorrectPlucking,
        },
        transform: {
            removeProxyRules,
        },
        generate: {
            calcReportFailures,
            inferenceMatchResult,
            generateBytecode,
            generateJS,
        },
    },

    // Generates a parser from a specified grammar AST. Throws |peg.GrammarError|
    // if the AST contains a semantic error. Note that not all errors are detected
    // during the generation and some may protrude to the generated parser and
    // cause its malfunction.
    compile( ast, session, options = {} ) {

        options = util.processOptions( options, {
            allowedStartRules: [ ast.rules[ 0 ].name ],
            cache: false,
            context: {},
            dependencies: {},
            exportVar: null,
            features: null,
            format: "bare",
            header: null,
            optimize: "speed",
            output: "parser",
            trace: false,
        } );

        // We want `session.vm.evalModule` to return the parser
        if ( options.output === "parser" ) options.format = "umd";

        util.each( session.passes, stage => {

            stage.forEach( pass => {

                pass( ast, session, options );

            } );

        } );

        switch ( options.output ) {

            case "parser":
                return session.vm.evalModule( ast.code, options.context );

            case "source":
                return ast.code;

            default:
                session.error( `Invalid output format: ${ options.output }.` );

        }

    },

};

export default compiler;
