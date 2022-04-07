export function asDict<T>(array: T[]) {
  return Object.assign({}, ...array);
}
