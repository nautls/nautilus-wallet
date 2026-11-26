import { describe, expect, it, vi } from "vitest";
import { useWalletBoxes } from "./useWalletBoxes";

const store = vi.hoisted(() => ({ follow: vi.fn() }));
vi.mock("@/stores/boxesStore", () => ({ useBoxesStore: () => store }));

describe("useWalletBoxes", () => {
  it("follows the boxes", () => {
    useWalletBoxes();
    expect(store.follow).toHaveBeenCalledOnce();
  });
});
