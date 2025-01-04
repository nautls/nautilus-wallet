import { describe, expect, it } from "vitest";
import { parse } from "./useNumericMask";

describe("parser", () => {
  it("should parse data correctly", () => {
    expect(parse("8.28076808")?.toString()).equal("8.28076808");
    expect(parse("10.001")?.toString()).equal("10.001");
    expect(parse("-10.001")?.toString()).equal("-10.001");

    expect(parse("1,123,100.001")?.toString()).equal("1123100.001");
    expect(parse("123,100.001")?.toString()).equal("123100.001");

    expect(parse(".001")?.toString()).equal("0.001");
    expect(parse("1.")?.toString()).equal("1");
  });

  it("should return null for invalid inputs", () => {
    expect(parse(".")).toBeNull();
    expect(parse(",")).toBeNull();
    expect(parse("")).toBeNull();
    expect(parse("-")).toBeNull();
    expect(parse("non numeric string")).toBeNull();
  });
});
