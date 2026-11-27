import { effectScope, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BigNumber, bn } from "@/common/bigNumber";
import type { AssetBalance } from "@/stores/walletStore";
import { useBalanceChanges } from "./useBalanceChanges";

function asset(tokenId: string, balance: number, decimals = 0): AssetBalance {
  return { tokenId, balance: bn(balance), metadata: { decimals } };
}

function noMetadata(tokenId: string, balance: number): AssetBalance {
  return { tokenId, balance: bn(balance) };
}

function setup(initial: AssetBalance[]) {
  const walletId = ref(1);
  const balances = ref(initial);
  const hidden = ref<AssetBalance[]>([]);
  const live = ref(true);
  const onChange = vi.fn<(deltas: Map<string, BigNumber>) => void>();
  const scope = effectScope();
  const changes = scope.run(() =>
    useBalanceChanges(
      () => walletId.value,
      () => balances.value,
      (tokenId) => [...balances.value, ...hidden.value].some((x) => x.tokenId === tokenId),
      () => live.value,
      onChange
    )
  )!;

  const update = async (opt: {
    id?: number;
    assets?: AssetBalance[];
    hidden?: AssetBalance[];
    live?: boolean;
  }) => {
    if (opt.id !== undefined) walletId.value = opt.id;
    if (opt.assets) balances.value = opt.assets;
    if (opt.hidden) hidden.value = opt.hidden;
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
    const { changes, update, onChange } = setup([noMetadata("a", 1000)]);

    await update({ assets: [asset("a", 10, 2)] });

    expect(onChange).not.toHaveBeenCalled();
    expect(changes.isNew("a")).toBe(false);
  });

  it("reports a token added without metadata once its metadata arrives", async () => {
    const { changes, update, onChange } = setup([asset("erg", 10)]);

    await update({ assets: [asset("erg", 10), noMetadata("a", 1500000)] });
    expect(onChange).not.toHaveBeenCalled();
    expect(changes.isNew("a")).toBe(false);

    await update({ assets: [asset("erg", 10), asset("a", 1.5, 6)] });
    expect(deltas(onChange)).toEqual({ a: 1.5 });
    expect(changes.isNew("a")).toBe(true);
  });

  it("doesn't report a token added without metadata that turns out to be hidden", async () => {
    const { changes, update, onChange } = setup([asset("erg", 10)]);

    await update({ assets: [asset("erg", 10), noMetadata("nft", 1)] });
    await update({ assets: [asset("erg", 10)], hidden: [asset("nft", 1)] });

    expect(onChange).not.toHaveBeenCalled();
    expect(changes.isRemoved("nft")).toBe(false);
  });

  it("doesn't report a held token that becomes hidden", async () => {
    const { changes, update, onChange } = setup([asset("erg", 10), asset("scam", 5)]);

    await update({ assets: [asset("erg", 10)], hidden: [asset("scam", 5)] });

    expect(onChange).not.toHaveBeenCalled();
    expect(changes.isRemoved("scam")).toBe(false);
  });

  it("doesn't report a held token without metadata until its metadata arrives", async () => {
    const { changes, update, onChange } = setup([asset("erg", 10), noMetadata("a", 2000000)]);

    await update({ assets: [asset("erg", 10), noMetadata("a", 3000000)] });
    await update({ assets: [asset("erg", 10), asset("a", 3, 6)] });

    expect(onChange).not.toHaveBeenCalled();
    expect(changes.isNew("a")).toBe(false);
  });

  it("doesn't report a held token spent before its metadata arrives", async () => {
    const { changes, update, onChange } = setup([asset("erg", 10), noMetadata("a", 2000000)]);

    await update({ assets: [asset("erg", 10)] });

    expect(onChange).not.toHaveBeenCalled();
    expect(changes.isRemoved("a")).toBe(false);
  });

  it("doesn't report a hidden token that is listed again", async () => {
    const { changes, update, onChange } = setup([asset("erg", 10), asset("scam", 5)]);

    await update({ assets: [asset("erg", 10)], hidden: [asset("scam", 5)] });
    await update({ assets: [asset("erg", 10), asset("scam", 5)], hidden: [] });

    expect(onChange).not.toHaveBeenCalled();
    expect(changes.isNew("scam")).toBe(false);
  });

  it("ignores updates that leave every balance the same", async () => {
    const { update, onChange } = setup([asset("erg", 10)]);

    await update({ assets: [asset("erg", 10)] });

    expect(onChange).not.toHaveBeenCalled();
  });
});
