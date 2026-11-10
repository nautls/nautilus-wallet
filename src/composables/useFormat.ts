import BigNumber from "bignumber.js";
import { bn } from "@/common/bigNumber";
import { isErg } from "@/common/utils";
import { getLocale } from "@/i18n";
import { currencySymbolMap } from "@/mappers/currencySymbolMap";
import { AssetInfo } from "@/types/internal";

export function useFormat() {
  return FORMATTERS;
}

const FALLBACK_LOCALE = "en-US";
const COMPACT_THRESHOLD = 1_000_000;
const NUMBER_PART_TYPES = new Set<Intl.NumberFormatPartTypes>([
  "integer",
  "group",
  "decimal",
  "fraction"
]);

const formatters = new Map<string, Intl.NumberFormat>();

/** Reads the locale on every call so templates and computeds re-run when it changes. */
function numberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const locale = getLocale();
  const key = `${locale}|${JSON.stringify(options)}`;

  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat([locale, FALLBACK_LOCALE], options);
    formatters.set(key, formatter);
  }

  return formatter;
}

function partValue(parts: Intl.NumberFormatPart[], type: Intl.NumberFormatPartTypes) {
  return parts.find((p) => p.type === type)?.value;
}

function separators() {
  const parts = numberFormat().formatToParts(12345.6);
  return {
    group: partValue(parts, "group") ?? "",
    decimal: partValue(parts, "decimal") ?? "."
  };
}

/** Whole BigNumber precision, with the locale's separators. */
function formatExact(value: BigNumber): string {
  const { group, decimal } = separators();
  return value.toFormat({
    prefix: "",
    suffix: "",
    decimalSeparator: decimal,
    groupSeparator: group,
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: "",
    fractionGroupSize: 0
  });
}

function format(value: number, maximumFractionDigits: number): string {
  return numberFormat({
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits >= 2 ? 2 : undefined,
    ...(value < 0.01 && maximumFractionDigits <= 2
      ? { minimumSignificantDigits: 2, maximumSignificantDigits: 2 }
      : {})
  }).format(value);
}

/**
 * Text around the number when the locale formats an amount of `currencyCode`, such as
 * `$` before it in en-US or ` $` after it in de-DE. Intl prints codes it has no symbol
 * for, like ERG, as the bare code, so those borrow EUR's layout with our own symbol.
 */
function currencyAffixes(currencyCode: string): { prefix: string; suffix: string } {
  const code = currencyCode.toUpperCase();
  const customSymbol = currencySymbolMap.get(currencyCode.toLowerCase());

  let parts: Intl.NumberFormatPart[];
  try {
    parts = numberFormat({ style: "currency", currency: code }).formatToParts(1);
  } catch {
    return { prefix: "", suffix: ` ${code}` };
  }

  let symbol = partValue(parts, "currency");
  if (customSymbol && symbol === code) {
    parts = numberFormat({ style: "currency", currency: "EUR" }).formatToParts(1);
    symbol = customSymbol;
  }

  const first = parts.findIndex((p) => NUMBER_PART_TYPES.has(p.type));
  const last = parts.findLastIndex((p) => NUMBER_PART_TYPES.has(p.type));
  const text = (slice: Intl.NumberFormatPart[]) =>
    slice.map((p) => (p.type === "currency" ? symbol : p.value)).join("");

  return { prefix: text(parts.slice(0, first)), suffix: text(parts.slice(last + 1)) };
}

const STRING_FORMATTERS = {
  uppercase(val?: string): string {
    if (!val || typeof val !== "string") return "";
    return val.toUpperCase();
  },
  lowercase(val?: string): string {
    if (!val || typeof val !== "string") return "";
    return val.toLowerCase();
  },
  shorten(
    val: string | undefined,
    maxLength: number,
    ellipsisPosition: "middle" | "end" | "none" = "middle"
  ): string {
    if (!val || maxLength >= val.length) return val ?? "";

    const ellipsis = "…";
    if (ellipsisPosition === "middle") {
      const fragmentSize = Math.trunc((maxLength - ellipsis.length) / 2);
      if (fragmentSize * 2 + ellipsis.length >= val.length) return val;
      return `${val.slice(0, fragmentSize).trimEnd()}${ellipsis}${val
        .slice(val.length - fragmentSize)
        .trimStart()}`;
    } else if (ellipsisPosition === "end") {
      return `${val.slice(0, maxLength - ellipsis.length + 1).trimEnd()}${ellipsis}`;
    }

    return val.slice(0, maxLength);
  }
};

const ASSET_FORMATTERS = {
  name(val?: AssetInfo, maxLen = 20): string {
    if (!val) return "";
    return STRING_FORMATTERS.shorten(
      val.metadata?.name || val.tokenId,
      val.metadata?.name ? maxLen : Math.floor(maxLen / 2)
    );
  },
  id(tokenId: string, maxLen = 7): string {
    return isErg(tokenId) ? "Ergo" : STRING_FORMATTERS.shorten(tokenId, maxLen, "none");
  }
};

const NUMBER_FORMATTERS = {
  decimal(
    value: BigNumber | undefined,
    decimalPlaces?: number,
    shortenThreshold = COMPACT_THRESHOLD
  ): string {
    if (!value) return "";
    if (value.gte(shortenThreshold)) {
      return numberFormat({
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 2
      }).format(value.toNumber());
    }
    if (decimalPlaces === undefined) return formatExact(value);
    return format(value.toNumber(), decimalPlaces);
  },
  percent(value: BigNumber | number | undefined): string {
    const val = typeof value === "number" ? value : value?.toNumber();
    return numberFormat({ style: "percent", maximumFractionDigits: 2 }).format(val ?? 0);
  },
  currency(value: BigNumber, currencyCode: string, decimals?: number): string {
    const formatted = this.decimal(value, decimals);
    const sign = /^[-\u2212]/.test(formatted) ? formatted[0] : "";
    const { prefix, suffix } = currencyAffixes(currencyCode);
    return `${sign}${prefix}${formatted.slice(sign.length)}${suffix}`;
  },
  namedCurrency(
    value: BigNumber | number | undefined,
    ticker: string | undefined,
    decimals?: number
  ): string {
    const formattedValue = this.decimal(typeof value === "number" ? bn(value) : value, decimals);
    return `${formattedValue} ${ticker ?? ""}`;
  }
};

const FORMATTERS = {
  string: STRING_FORMATTERS,
  number: NUMBER_FORMATTERS,
  asset: ASSET_FORMATTERS
};
