import { describe, expect, it } from "vitest";
import { bn, decimalize, undecimalize } from "@/common/bigNumber";

describe("bigNumber helpers", () => {
  it("decimalize numbers with various decimal places", () => {
    const base = "100000000000000000000000000000";
    for (let i = 0; i < base.length; i++) {
      expect(decimalize(bn(base), i).toString(10)).toEqual(base.slice(0, base.length - i));
    }
  });

  it("decimalize numbers with huge decimals", () => {
    const hugeDecimalsNumber =
      "100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";
    const expected =
      "1000000000000000000.00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";

    expect(decimalize(bn(hugeDecimalsNumber), 101).toString()).toEqual(expected);
  });

  it("undecimalize numbers with various decimal places", () => {
    const base = "1";
    for (let i = 0; i < 20; i++) {
      base.padEnd(i, "0");
      expect(undecimalize(bn(base), i).toString()).toEqual(base.padEnd(base.length + i, "0"));
    }
  });

  it("undecimalize numbers with huge decimals", () => {
    const hugeDecimalsNumber =
      "1000000000000000000.00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";
    const expected =
      "100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";

    expect(undecimalize(bn(hugeDecimalsNumber), 101).toString(10)).toEqual(expected);
  });
});
