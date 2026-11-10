import { describe, expect, it, vi } from "vitest";
import { bn } from "@/common/bigNumber";
import { useFormat } from "./useFormat";

let locale = "en-US";
vi.mock("@/i18n", () => ({ getLocale: () => locale }));

const { number } = useFormat();
const NNBSP = " ";
const NBSP = " ";

function inLocale<T>(l: string, fn: () => T): T {
  const previous = locale;
  locale = l;
  try {
    return fn();
  } finally {
    locale = previous;
  }
}

describe("number formatting", () => {
  it("keeps full precision with the locale's separators", () => {
    const value = bn("1234.123456789012345678");

    expect(inLocale("en-US", () => number.decimal(value))).toBe("1,234.123456789012345678");
    expect(inLocale("de-DE", () => number.decimal(value))).toBe("1.234,123456789012345678");
    expect(inLocale("fr-FR", () => number.decimal(value))).toBe(`1${NNBSP}234,123456789012345678`);
  });

  it("rounds to the given decimal places", () => {
    expect(inLocale("en-US", () => number.decimal(bn("4200.456"), 2))).toBe("4,200.46");
    expect(inLocale("pt-BR", () => number.decimal(bn("4200.456"), 2))).toBe("4.200,46");
    expect(inLocale("de-DE", () => number.decimal(bn("0.001234"), 2))).toBe("0,0012");
  });

  it("shortens large amounts in the locale's words", () => {
    expect(inLocale("en-US", () => number.decimal(bn(1_250_000)))).toBe("1.25M");
    expect(inLocale("de-DE", () => number.decimal(bn(1_250_000)))).toBe(`1,25${NBSP}Mio.`);
  });

  it("follows the UI locale when it changes", () => {
    expect(inLocale("en-US", () => number.percent(0.125))).toBe("12.5%");
    expect(inLocale("de-DE", () => number.percent(0.125))).toBe(`12,5${NBSP}%`);
  });

  it("falls back to en-US for locales Intl doesn't know", () => {
    expect(inLocale("xx-XX", () => number.decimal(bn("1234.5")))).toBe("1,234.5");
  });
});

describe("currency formatting", () => {
  const amount = bn("3588.54");

  it("places the symbol the way each locale does", () => {
    expect(inLocale("en-US", () => number.currency(amount, "usd", 2))).toBe("$3,588.54");
    expect(inLocale("de-DE", () => number.currency(amount, "eur", 2))).toBe(`3.588,54${NBSP}€`);
    expect(inLocale("pt-BR", () => number.currency(amount, "brl", 2))).toBe(`R$${NBSP}3.588,54`);
    expect(inLocale("zh-CN", () => number.currency(amount, "usd", 2))).toBe("US$3,588.54");
  });

  it("uses our own symbol for coins Intl has none for", () => {
    expect(inLocale("en-US", () => number.currency(amount, "erg", 2))).toBe("Σ3,588.54");
    expect(inLocale("de-DE", () => number.currency(amount, "erg", 2))).toBe(`3.588,54${NBSP}Σ`);
  });

  it("keeps full precision when no decimals are given", () => {
    expect(inLocale("en-US", () => number.currency(bn("12.123456789"), "erg"))).toBe(
      "Σ12.123456789"
    );
  });

  it("splits the amount into styleable parts", () => {
    expect(inLocale("en-US", () => number.currencyParts(amount, "usd", 2))).toEqual({
      prefix: "$",
      integer: "3,588",
      fraction: ".54",
      suffix: ""
    });
    expect(inLocale("de-DE", () => number.currencyParts(amount, "usd", 2))).toEqual({
      prefix: "",
      integer: "3.588",
      fraction: ",54",
      suffix: `${NBSP}$`
    });
  });

  it("doesn't split compact amounts at their decimal separator", () => {
    expect(inLocale("de-DE", () => number.currencyParts(bn(1_250_000), "eur", 2))).toEqual({
      prefix: "",
      integer: `1,25${NBSP}Mio.`,
      fraction: "",
      suffix: `${NBSP}€`
    });
  });
});
