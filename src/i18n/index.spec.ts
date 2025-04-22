import { describe, expect, it } from "vitest";
import { fallback } from ".";

describe("locale fallback", () => {
  const locales = ["en-US", "en-GB", "pt-BR", "de-DE", "de-AT"];

  it("should match the exact locale", () => {
    expect(fallback("en-US", locales)).toBe("en-US");
    expect(fallback("pt-BR", locales)).toBe("pt-BR");
    expect(fallback("de-DE", locales)).toBe("de-DE");
    expect(fallback("en-GB", locales)).toBe("en-GB");
    expect(fallback("de-AT", locales)).toBe("de-AT");
  });

  it("should match the language", () => {
    expect(fallback("en", locales)).toBe("en-US");
    expect(fallback("pt", locales)).toBe("pt-BR");
    expect(fallback("de", locales)).toBe("de-DE");

    expect(fallback("pt-PT", locales)).toBe("pt-BR");
    expect(fallback("en-AU", locales)).toBe("en-US");
    expect(fallback("en-CA", locales)).toBe("en-US");
    expect(fallback("de-CH", locales)).toBe("de-DE");
  });

  it("should match variants", () => {
    expect(fallback("de-DE-bavarian", locales)).toBe("de-DE");
    expect(fallback("en-US-texas", locales)).toBe("en-US");
    expect(fallback("pt-BR-northeast", locales)).toBe("pt-BR");
    expect(fallback("en-US-texas-houston", locales)).toBe("en-US");
    expect(fallback("de-DE-bavarian-munich", locales)).toBe("de-DE");
  });

  it("should return undefined for unsupported languages", () => {
    expect(fallback("fr", locales)).toBe("en-US");
    expect(fallback("fr-FR", locales)).toBe("en-US");
    expect(fallback("es-ES", locales)).toBe("en-US");
    expect(fallback("ja-JP", locales)).toBe("en-US");
  });

  it("should handle edge cases", () => {
    expect(fallback("", locales)).toBe("en-US");
    expect(fallback("-", locales)).toBe("en-US");
    expect(fallback("en-", locales)).toBe("en-US");
    expect(fallback("-US", locales)).toBe("en-US");
  });
});
