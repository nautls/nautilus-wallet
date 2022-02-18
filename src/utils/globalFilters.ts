import { logoMapper } from "@/mappers/logoMapper";
import { WalletType } from "@/types/internal";
import BigNumber from "bignumber.js";
import { VueElement } from "vue";

const defaultBitNumbersFormatter = Intl.NumberFormat("en", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 2
});

export const filters = {
  uppercase(val: string): string {
    return val?.toUpperCase() ?? "";
  },
  lowercase(val: string): string {
    return val?.toLowerCase() ?? "";
  },
  compactString(
    val: string,
    maxLength: number,
    ellipsisPosition: "middle" | "end" = "middle"
  ): string {
    if (!val || maxLength >= val.length) {
      return val;
    }

    const ellipsis = "…";
    if (ellipsisPosition === "middle") {
      const fragmentSize = Math.trunc((maxLength - ellipsis.length) / 2);
      if (fragmentSize * 2 + ellipsis.length >= val.length) {
        return val;
      }
      return `${val.slice(0, fragmentSize)}${ellipsis}${val.slice(val.length - fragmentSize)}`;
    } else {
      return `${val.slice(0, maxLength - ellipsis.length + 1)}${ellipsis}`;
    }
  },
  formatBigNumber(value: BigNumber) {
    if (value.isGreaterThanOrEqualTo(1_000_000)) {
      return defaultBitNumbersFormatter.format(value.toNumber());
    }

    return value.toFormat();
  },
  assetLogo(tokenId: string): string {
    const assetLogo = logoMapper[tokenId];
    return `/icons/assets/${assetLogo ?? "default.svg"}`;
  },
  walletType(type: WalletType): string {
    switch (type) {
      case WalletType.Standard:
        return "Standard";
      case WalletType.ReadOnly:
        return "Read-only";
      case WalletType.Ledger:
        return "Ledger";
      default:
        return "";
    }
  }
};
