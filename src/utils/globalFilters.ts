import { logoMapper } from "@/mappers/logoMapper";
import { WalletType } from "@/types/internal";
import { Address } from "@coinbarn/ergo-ts";
import BigNumber from "bignumber.js";

const defaultBitNumbersFormatter = Intl.NumberFormat("en", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 2
});

export const filters = {
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
  },
  getAddressFromErgoTree(ergoTree: string): string {
    return Address.fromErgoTree(ergoTree).address;
  },
  parseEIP4Register(input: any): string | undefined {
    if (typeof input !== "string" || !input.startsWith("0e") || input.length < 4) {
      return;
    }

    let body = input.slice(2);
    let len = 0;
    let readNext = true;
    do {
      const lenChunk = parseInt(body.slice(0, 2), 16);
      body = body.slice(2);
      if (isNaN(lenChunk)) {
        return;
      }
      readNext = (lenChunk & 0x80) !== 0;
      len = 128 * len + (lenChunk & 0x7f);
    } while (readNext);
    // if (2 * len > body.length) {
    //   log(`vlq decode trailing data: ${body.slice(2 * len)}`);
    // }
    if (2 * len < body.length) {
      return;
    }
    return Buffer.from(body.slice(0, 2 * len), "hex").toString("utf8");
  }
};
