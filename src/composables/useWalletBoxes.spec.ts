import { effectScope, nextTick, reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTxReady, useWalletBoxes } from "./useWalletBoxes";

const mocks = vi.hoisted(() => ({
  store: { follow: vi.fn(), status: "loading" },
  wallet: { id: 1 }
}));
vi.mock("@/stores/boxesStore", () => ({ useBoxesStore: () => mocks.store }));
vi.mock("@/stores/walletStore", () => ({ useWalletStore: () => mocks.wallet }));

beforeEach(() => {
  mocks.store = reactive({ follow: vi.fn(), status: "loading" });
  mocks.wallet = reactive({ id: 1 });
});

describe("useWalletBoxes", () => {
  it("follows the boxes, and the next wallet's once it changes", async () => {
    effectScope().run(() => useWalletBoxes());
    expect(mocks.store.follow).toHaveBeenCalledOnce();

    mocks.wallet.id = 2;
    await nextTick();
    expect(mocks.store.follow).toHaveBeenCalledTimes(2);
  });
});

describe("useTxReady", () => {
  it("is ready only once the boxes are", () => {
    const ready = effectScope().run(() => useTxReady())!;
    expect(ready.value).toBe(false);

    mocks.store.status = "ready";
    expect(ready.value).toBe(true);
  });

  it("takes a refusal as ready when the page reads the boxes over REST", () => {
    mocks.store.status = "error";
    expect(effectScope().run(() => useTxReady())!.value).toBe(false);
    expect(effectScope().run(() => useTxReady(true))!.value).toBe(true);
  });
});
