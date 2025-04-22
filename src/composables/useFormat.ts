import BigNumber from "bignumber.js";
import { bn } from "@/common/bigNumber";
import { isErg } from "@/common/utils";
import { currencySymbolMap } from "@/mappers/currencySymbolMap";
import { AssetInfo } from "@/types/internal";

export function useFormat() {
  return FORMATTERS;
}

const COMPACT_FORMATTER = Intl.NumberFormat("en", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 2
});

const PERCENT_FORMATTER = Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 2
});

function format(value: number, maximumFractionDigits: number): string {
  return Intl.NumberFormat("en", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits >= 2 ? 2 : undefined,
    ...(value < 0.01 && maximumFractionDigits <= 2
      ? { minimumSignificantDigits: 2, maximumSignificantDigits: 2 }
      : {})
  }).format(value);
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
  decimal(value: BigNumber | undefined, decimalPlaces?: number, shortenThreshold = 1_000_000) {
    if (!value) return "";
    if (value.gte(shortenThreshold)) return COMPACT_FORMATTER.format(value.toNumber());
    if (decimalPlaces === undefined) return value.toFormat();
    return format(value.toNumber(), decimalPlaces);
  },
  percent(value: BigNumber | number | undefined): string {
    const val = typeof value === "number" ? value : value?.toNumber();
    return PERCENT_FORMATTER.format(val ?? 0);
  },
  currency(value: BigNumber, currencyCode: string, decimals?: number): string {
    const formattedValue = this.decimal(value, decimals);
    const currencySymbol = currencySymbolMap.get(currencyCode);
    return currencySymbol
      ? `${currencySymbol} ${formattedValue}`
      : `${formattedValue} ${STRING_FORMATTERS.uppercase(currencyCode)}`;
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
