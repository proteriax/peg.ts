// Bytecode instruction opcodes.
export enum opcodes {
  // Stack Manipulation

  PUSH_EMPTY_STRING, // PUSH_EMPTY_STRING
  PUSH_UNDEFINED, // PUSH_UNDEFINED
  PUSH_NULL, // PUSH_NULL
  PUSH_FAILED, // PUSH_FAILED
  PUSH_EMPTY_ARRAY, // PUSH_EMPTY_ARRAY
  PUSH_CURR_POS, // PUSH_CURR_POS
  POP, // POP
  POP_CURR_POS, // POP_CURR_POS
  POP_N, // POP_N n
  NIP, // NIP
  APPEND, // APPEND
  WRAP, // WRAP n
  TEXT, // TEXT
  PLUCK = 41, // PLUCK n, k, p1, ..., pK

  // Conditions and Loops

  IF = 13, // IF t, f
  IF_ERROR, // IF_ERROR t, f
  IF_NOT_ERROR, // IF_NOT_ERROR t, f
  WHILE_NOT_ERROR, // WHILE_NOT_ERROR b

  // Matching

  MATCH_ANY, // MATCH_ANY a, f, ...
  MATCH_STRING, // MATCH_STRING s, a, f, ...
  MATCH_STRING_IC, // MATCH_STRING_IC s, a, f, ...
  MATCH_CLASS, // MATCH_CLASS c, a, f, ...
  ACCEPT_N, // ACCEPT_N n
  ACCEPT_STRING, // ACCEPT_STRING s
  EXPECT, // EXPECT e

  // Calls

  LOAD_SAVED_POS, // LOAD_SAVED_POS p
  UPDATE_SAVED_POS, // UPDATE_SAVED_POS
  CALL, // CALL f, n, pc, p1, p2, ..., pN

  // Rules

  RULE, // RULE r

  // Failure Reporting

  SILENT_FAILS_ON, // SILENT_FAILS_ON
  SILENT_FAILS_OFF, // SILENT_FAILS_OFF

  EXPECT_NS_BEGIN = 38, // EXPECT_NS_BEGIN
  EXPECT_NS_END, // EXPECT_NS_END invert
}
