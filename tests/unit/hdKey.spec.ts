import { describe, expect, it } from "vitest";
import { walletChecksum } from "@emurgo/cip4-js";
import HdKey from "../../src/chains/ergo/hdKey";

describe("address generation", () => {
  const xpk =
    "0488b21e000000000000000000b345a673afdeb85091c35d02083035f6e0ca284b1846223b23b566c4070a0cec02a3ad1969b60e85426791b75eccf038e6105c3afab8167af7eb6b73e709b81882";
  const mnemonic =
    "fade payment weasel market mixed armed decade shed harbor bind deal mandate pink earth second";

  it("calculates valid CIP4 checksum", () => {
    const plate = walletChecksum(xpk);

    expect(plate.TextPart).toEqual("LHBB-1130");
    expect(plate.ImagePart).toEqual(
      "5d33031ea3bbba9d3332559b1dafd8612683092f535273a4c15ffa103ffa3fc11f7b6992f5a034b3c8dd30f6f103b24e500c44ba4cff2e5c7f6e3e2eb124cd32"
    );
  });

  it("Should derive addresses form mnemonic", async () => {
    const deriver = await HdKey.fromMnemonic(mnemonic);
    const addresses = [
      "9ewWr5fZF9QdtN9XrLXybyyVcBtPwrx4ZbKaJX5SsPnQQC8k6ry",
      "9hNzwisyeVL1b9WTUG1gbWUfsTuRrn24hTvBCaqh8fRCuKdGWa8",
      "9fAzrkobHhThfpsByj4CZzUr6riYxrUtn7TjjFP88UQBFhmU5Kg"
    ];

    for (let i = 0; i < addresses.length; i++) {
      const address = deriver.deriveAddress(i);
      expect(address.script).toEqual(addresses[i]);
    }
  });

  it("Should derive addresses form extended public key", () => {
    const deriver = HdKey.fromPublicKey(xpk);
    const addresses = [
      "9gb9rqEPei5iNDUwRJphE9CJdCe76KMWAge3mGhLFKCQj82CPjE",
      "9hSNKhXY48mt6N5iNPwFpoit9dJtJdQzMpWuijwE68frRTZcmSy",
      "9exq3iYVYUX4GTY7cd6QDYjcPUj2ZxummaoTeVSH1crqtii8d1g"
    ];

    for (let i = 0; i < addresses.length; i++) {
      const address = deriver.deriveAddress(i);
      expect(address.script).toEqual(addresses[i]);
    }
  });
});
