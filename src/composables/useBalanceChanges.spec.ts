import { effectScope, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BigNumber, bn } from "@/common/bigNumber";
import type { AssetBalance } from "@/stores/walletStore";
import { useBalanceChanges } from "./useBalanceChanges";

function asset(tokenId: string, balance: number, decimals?: number): AssetBalance {
  return {
    tokenId,
    balance: bn(balance),
    metadata: decimals === undefined ? undefined : { decimals }
  };
}

function setup(initial: AssetBalance[]) {
  const walletId = ref(1);
  const balances = ref(initial);
  const live = ref(true);
  const onChange = vi.fn<(deltas: Map<string, BigNumber>) => void>();
  const scope = effectScope();
  const changes = scope.run(() =>
    useBalanceChanges(
      () => walletId.value,
      () => balances.value,
      () => live.value,
      onChange
    )
  )!;

  const update = async (opt: { id?: number; assets?: AssetBalance[]; live?: boolean }) => {
    if (opt.id !== undefined) walletId.value = opt.id;
    if (opt.assets) balances.value = opt.assets;
    if (opt.live !== undefined) live.value = opt.live;
    await nextTick();
  };

  return { changes, update, onChange };
}

function deltas(onChange: ReturnType<typeof setup>["onChange"]) {
  const [map] = onChange.mock.lastCall!;
  return Object.fromEntries([...map].map(([k, v]) => [k, v.toNumber()]));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useBalanceChanges", () => {
  it("reports changed, added and removed tokens of the same wallet", async () => {
    const { changes, update, onChange } = setup([asset("erg", 10), asset("a", 5), asset("b", 1)]);
    const ergKey = changes.amountKey("erg");

    await update({ assets: [asset("erg", 8), asset("a", 5), asset("c", 3)] });

    expect(deltas(onChange)).toEqual({ erg: -2, c: 3, b: -1 });
    expect(changes.direction("erg")).toBe("down");
    expect(changes.amountKey("erg")).not.toBe(ergKey);
    expect(changes.direction("a")).toBeUndefined();
    expect(changes.isNew("c")).toBe(true);
    expect(changes.isRemoved("b")).toBe(true);
    expect(changes.isRemoved("a")).toBe(false);

    vi.runAllTimers();
    expect(changes.isNew("c")).toBe(false);
  });

  it("doesn't report changes made while not live", async () => {
    const { changes, update, onChange } = setup([asset("erg", 10)]);

    await update({ live: false });
    await update({ assets: [asset("erg", 12), asset("a", 1)] });
    await update({ live: true });

    expect(onChange).not.toHaveBeenCalled();
    expect(changes.direction("erg")).toBeUndefined();
    expect(changes.isNew("a")).toBe(false);
    expect(changes.isRemoved("erg")).toBe(false);
  });

  it("doesn't report a switch to another wallet", async () => {
    const { changes, update, onChange } = setup([asset("erg", 10)]);

    await update({ id: 2, assets: [asset("erg", 3)] });

    expect(onChange).not.toHaveBeenCalled();
    expect(changes.direction("erg")).toBeUndefined();
  });

  it("doesn't report an amount that changes because its decimals arrived", async () => {
    const { update, onChange } = setup([asset("a", 1000)]);

    await update({ assets: [asset("a", 10, 2)] });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores updates that leave every balance the same", async () => {
    const { update, onChange } = setup([asset("erg", 10)]);

    await update({ assets: [asset("erg", 10)] });

    expect(onChange).not.toHaveBeenCalled();
  });
});
