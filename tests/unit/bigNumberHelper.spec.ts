import { decimalize, undecimalize } from "@/utils/bigNumbers";
import BigNumber from "bignumber.js";

describe("bigNumber helpers", () => {
  it("decimalize numbers with various decimal places", () => {
    const base = "10000000000000000000";
    for (let i = 0; i < base.length; i++) {
      expect(decimalize(new BigNumber(base), i).toString()).toEqual(base.slice(0, base.length - i));
    }
  });

  it("undecimalize numbers with various decimal places", () => {
    let base = "1";
    for (let i = 0; i < 20; i++) {
      base.padEnd(i, "0");
      expect(undecimalize(new BigNumber(base), i).toString()).toEqual(
        base.padEnd(base.length + i, "0")
      );
    }
  });
});
