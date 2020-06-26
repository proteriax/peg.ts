export class Ref<T extends string = string> {
  constructor(private id: T) {}
  toString() {
    return this.id
  }
  set(value: Ref | string) {
    return `${this} = ${value};`
  }
  _(...args: (Ref | string)[]) {
    return ref(`${this}(${args.join(", ")})`)
  }
  get(property: Ref | string | number) {
    return ref(`${this}[${property}]`)
  }
  equal(right: Ref | string | number) {
    return ref(`${this} === ${right}`)
  }
  notEqual(right: Ref | string | number) {
    return ref(`${right} !== ${this}`)
  }
  substr(start: number | Ref, end: number | Ref) {
    return ref(this.id + `.substr(${start}, ${end})`)
  }
  toLowerCase() {
    return ref(this.id + ".toLowerCase()")
  }
  inc() {
    return ref(this.id + "++")
  }
  dec() {
    return ref(this.id + "--")
  }
  length() {
    return ref(`${this}.length`)
  }
}

export function ref<T extends string>(identifier: T) {
  return new Ref(identifier)
}

export function $let(variableName: Ref | string, value?: string | number) {
  return `let ${variableName}` + (value == null ? ";" : ` = ${value};`)
}
export function $const(variableName: Ref | string, value: string | number) {
  return `const ${variableName} = ${value};`
}
