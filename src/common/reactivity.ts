import { ShallowRef } from "vue";

export function patchArray<T>(
  state: ShallowRef<T[]>,
  changes: T[],
  removed: T[],
  predicate: (current: T, changed: T) => boolean
) {
  for (const changed of changes) {
    const index = state.value.findIndex((old) => predicate(old, changed));

    if (index > -1) {
      state.value[index] = changed;
    } else {
      state.value.push(changed);
    }
  }

  for (const item of removed) {
    const index = state.value.findIndex((old) => predicate(old, item));
    if (index > -1) state.value.splice(index, 1);
  }

  if (changes.length > 0 || removed.length > 0) {
    state.value = state.value.slice(); // trigger reactivity
  }
}
