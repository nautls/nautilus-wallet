import { domainToASCII } from "node:url";
import { describe, expect, it } from "vitest";
import { punycode } from "./punycode";

describe("punycode", () => {
  it("should encode the RFC 3492 sample strings", () => {
    expect(punycode("bücher")).toBe("bcher-kva");
    expect(punycode("\u{1F431}")).toBe("5o8h");
  });

  it.each([
    "\u{1F431}",
    "\u{1F431}\u{1F680}",
    "cat-\u{1F431}",
    "\u{1F1FA}\u{1F1F8}",
    "a\u{1F600}b\u{1F600}c",
    "\u{1F431}".repeat(14)
  ])("should match the platform's IDNA encoder for %s", (label) => {
    expect(`xn--${punycode(label)}.erg`).toBe(domainToASCII(`${label}.erg`));
  });
});
