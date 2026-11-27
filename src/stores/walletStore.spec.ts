import { describe, expect, it, vi } from "vitest";
import { bn } from "@/common/bigNumber";
import { incomingAmount } from "./walletStore";

vi.mock("webextension-polyfill", () => ({ default: {} }));

describe("incomingAmount", () => {
  it("is undefined when nothing is pending", () => {
    expect(incomingAmount([{}, { unconfirmedAmount: undefined }])).toBeUndefined();
  });

  it("is the pending amount received from someone else", () => {
    expect(incomingAmount([{ unconfirmedAmount: bn(5) }, {}])?.toString()).toBe("5");
  });

  it("nets a spend's change against its spent inputs", () => {
    const spend = [{ unconfirmedAmount: bn(-100) }, { unconfirmedAmount: bn(89.9) }];
    expect(incomingAmount(spend)).toBeUndefined();
  });

  it("keeps what is left over after a spend", () => {
    const assets = [{ unconfirmedAmount: bn(-10) }, { unconfirmedAmount: bn(25) }];
    expect(incomingAmount(assets)?.toString()).toBe("15");
  });
});
