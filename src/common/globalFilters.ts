import { BigNumber } from "bignumber.js";
import { bn } from "./bigNumber";
import { WalletType } from "@/types/internal";

const defaultBigNumbersFormatter = Intl.NumberFormat("en", {
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
    val: string | undefined,
    maxLength: number,
    ellipsisPosition: "middle" | "end" = "middle"
  ): string {
    if (!val || maxLength >= val.length) {
      return val ?? "";
    }

    const ellipsis = "…";
    if (ellipsisPosition === "middle") {
      const fragmentSize = Math.trunc((maxLength - ellipsis.length) / 2);
      if (fragmentSize * 2 + ellipsis.length >= val.length) {
        return val;
      }
      return `${val.slice(0, fragmentSize).trimEnd()}${ellipsis}${val
        .slice(val.length - fragmentSize)
        .trimStart()}`;
    } else {
      return `${val.slice(0, maxLength - ellipsis.length + 1).trimEnd()}${ellipsis}`;
    }
  },
  formatBigNumber(value?: BigNumber, decimalPlaces?: number, shortThreshold = 1_000_000) {
    if (!value) return "";

    if (value.isGreaterThanOrEqualTo(shortThreshold)) {
      return defaultBigNumbersFormatter.format(value.toNumber());
    }

    return value.isLessThan(0.1)
      ? this.roundToSignificantFigures(value.toNumber(), decimalPlaces ?? 2).toFormat()
      : value.toFormat(decimalPlaces);
  },
  roundToSignificantFigures(num: number, n: number) {
    if (num === 0) return bn(0);

    const d = Math.ceil(Math.log10(num < 0 ? -num : num));
    const power = n - d;

    const magnitude = Math.pow(10, power);
    const shifted = Math.round(num * magnitude);
    return bn(shifted / magnitude);
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
  },
  formatBytes(bytes: number, decimals = 1) {
    if (!+bytes) return "0 bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }
};
