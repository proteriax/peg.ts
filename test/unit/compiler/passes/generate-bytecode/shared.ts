export const bytecodeDetails = (...bytecode: number[]) => ({
  rules: [{ bytecode }],
})

export const constsDetails = (
  literals: string[],
  classes: todo[],
  expectations: todo[],
  functions
) => ({
  literals,
  classes,
  expectations,
  functions,
})
