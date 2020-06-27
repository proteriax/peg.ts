import { mapValues } from "lodash"
import type { ICompilerPass, IPassesMap } from "../compiler/session"

export interface IStageMap {
  [stage: string]: ICompilerPass[] | { [pass: string]: ICompilerPass }
}

/**
 * ```ts
 * type Session = peg.compiler.Session;
 * type Pass = (ast: {}, session: Session, options: {}) => void;
 * type StageMap = { [string]: { [string]: Pass } };
 * type PassMap = { [string]: Pass[] };
 * ```
 *
 * The PEG.js compiler runs each `Pass` on the `PassMap` (the `passes` option on it's 2nd
 * argument), but the compiler api exposes a `StageMap` so that it is easier for plugin
 * developer's to access the built-in passes.
 *
 * This method takes a `StageMap`, returning a `PassMap` that can be used by the compiler.
 */
export function convertPasses(stages: IStageMap): IPassesMap {
  return mapValues(stages, passes =>
    Array.isArray(passes) ? passes : Object.values(passes)
  )
}

export { regexpEscape, reservedWords } from "./js"
export { evalModule } from "./vm"
