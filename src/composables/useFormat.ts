import { BigNumber } from "bignumber.js";
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

function format(value: number, maximumFractionDigits: number): string {
  return Intl.NumberFormat("en", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits >= 2 ? 2 : undefined
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
  }
};

const BN_FORMATTERS = {
  format(value?: BigNumber, decimalPlaces?: number, shortenThreshold = 1_000_000) {
    if (!value) return "";
    if (value.gte(shortenThreshold)) return COMPACT_FORMATTER.format(value.toNumber());
    if (decimalPlaces === undefined) return value.toFormat();
    return format(value.toNumber(), decimalPlaces);
  }
};

const CURRENCY_FORMATTERS = {
  amount(value: BigNumber, currencyId: string, decimals = 2): string {
    const formattedValue = BN_FORMATTERS.format(value, decimals);
    const currencySymbol = currencySymbolMap.get(currencyId);
    return currencySymbol
      ? `${currencySymbol} ${formattedValue}`
      : `${formattedValue} ${STRING_FORMATTERS.uppercase(currencyId)}`;
  }
};

const FORMATTERS = {
  string: STRING_FORMATTERS,
  bn: BN_FORMATTERS,
  asset: ASSET_FORMATTERS,
  currency: CURRENCY_FORMATTERS
};
