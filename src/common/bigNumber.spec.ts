import { describe, expect, it } from "vitest";
import { isProxy, nextTick, reactive, ref, watch } from "vue";
import { bn } from "./bigNumber";

describe("BigNumber reactivity", () => {
  it("is not proxied in reactive state", () => {
    const state = reactive({ amount: bn(1), list: [bn(2)] });

    expect(isProxy(state.amount)).toBe(false);
    expect(isProxy(state.list[0])).toBe(false);
    expect(isProxy(reactive({ x: state.amount.plus(1) }).x)).toBe(false);
  });

  it("still triggers watchers when replaced", async () => {
    const state = ref({ amount: bn(1) });
    let calls = 0;
    watch(state, () => calls++, { deep: true });

    state.value.amount = bn(2);
    await nextTick();

    expect(calls).toBe(1);
  });
});
