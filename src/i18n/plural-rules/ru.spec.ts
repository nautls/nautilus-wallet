import { describe, expect, it } from "vitest";
import { russianPluralRules } from "./ru";

describe("Plural rules for Russian", () => {
  const implicitZeroHandlingLen = 3; //            [0] singular | [1] paucal | [2] plural
  const explicitZeroHandlingLen = 4; // [0] zero | [1] singular | [2] paucal | [3] plural

  it("should resolve zero", () => {
    expect(russianPluralRules(0, implicitZeroHandlingLen)).toBe(2); // plural
    expect(russianPluralRules(0, explicitZeroHandlingLen)).toBe(0); // zero
  });

  it("should resolve singular", () => {
    expect(russianPluralRules(1, implicitZeroHandlingLen)).toBe(0); // singular
    expect(russianPluralRules(21, implicitZeroHandlingLen)).toBe(0); // singular
    expect(russianPluralRules(211, implicitZeroHandlingLen)).toBe(0); // singular

    expect(russianPluralRules(1, explicitZeroHandlingLen)).toBe(1); // singular
    expect(russianPluralRules(101, explicitZeroHandlingLen)).toBe(1); // singular
  });

  it("should resolve paucal", () => {
    expect(russianPluralRules(2, implicitZeroHandlingLen)).toBe(1); // paucal
    expect(russianPluralRules(3, implicitZeroHandlingLen)).toBe(1); // paucal
    expect(russianPluralRules(4, implicitZeroHandlingLen)).toBe(1); // paucal
    expect(russianPluralRules(44, implicitZeroHandlingLen)).toBe(1); // paucal;
    expect(russianPluralRules(53, implicitZeroHandlingLen)).toBe(1); // paucal;

    expect(russianPluralRules(2, explicitZeroHandlingLen)).toBe(2); // paucal
    expect(russianPluralRules(3, explicitZeroHandlingLen)).toBe(2); // paucal
    expect(russianPluralRules(4, explicitZeroHandlingLen)).toBe(2); // paucal
    expect(russianPluralRules(22, explicitZeroHandlingLen)).toBe(2); // paucal
    expect(russianPluralRules(103, explicitZeroHandlingLen)).toBe(2); // paucal
  });

  it("should resolve plural", () => {
    expect(russianPluralRules(5, implicitZeroHandlingLen)).toBe(2); // plural
    expect(russianPluralRules(11, implicitZeroHandlingLen)).toBe(2); // plural
    expect(russianPluralRules(1000, implicitZeroHandlingLen)).toBe(2); // plural

    expect(russianPluralRules(5, explicitZeroHandlingLen)).toBe(3); // plural
    expect(russianPluralRules(6, explicitZeroHandlingLen)).toBe(3); // plural
  });
});
