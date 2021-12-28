import Bip32 from "@/api/ergo/bip32";
import { walletChecksum } from "@emurgo/cip4-js";

describe("address generation", () => {
  const extendedPublicKey =
    "0488b21e000000000000000000b345a673afdeb85091c35d02083035f6e0ca284b1846223b23b566c4070a0cec02a3ad1969b60e85426791b75eccf038e6105c3afab8167af7eb6b73e709b81882";

  let bip32!: Bip32;
  beforeAll(async () => {
    bip32 = Bip32.fromPublicKey(extendedPublicKey);
  });

  it("calculates valid CIP4 checksum", () => {
    const plate = walletChecksum(extendedPublicKey);

    expect(plate.TextPart).toEqual("LHBB-1130");
    expect(plate.ImagePart).toEqual(
      "5d33031ea3bbba9d3332559b1dafd8612683092f535273a4c15ffa103ffa3fc11f7b6992f5a034b3c8dd30f6f103b24e500c44ba4cff2e5c7f6e3e2eb124cd32"
    );
  });

  it("derive addresses", () => {
    const validAddresses = [
      "9gb9rqEPei5iNDUwRJphE9CJdCe76KMWAge3mGhLFKCQj82CPjE",
      "9hSNKhXY48mt6N5iNPwFpoit9dJtJdQzMpWuijwE68frRTZcmSy",
      "9exq3iYVYUX4GTY7cd6QDYjcPUj2ZxummaoTeVSH1crqtii8d1g",
      "9fZ1Eh4Un6UYhyP3wCXXusQsmibas6BHaV5KskjWMxTQdv7gBoC",
      "9fUdcXt21N4uY5NCM67DQLeGrwDExgX64MH9vC1fJ1MeAQ5wTad",
      "9f7dHv5QJU155DMGCtwJWvNJDaGD32PhR2Scbu9ygi8k5dBUgV4",
      "9fQ7ekKLSaXDBsRMKQaARxTjBGyUDpceBBhrWgLGYDGB3kAuhke",
      "9fLB2SVgrRh18NDFyNNB1TtoYttwaN2yFJZVYKaeTDRTdhLdRN9",
      "9ff4t4JeHNLHEyrDNP46iUGyskgQX6ESLbFtWG9D32wYSaw3CwU",
      "9hRgvdYPmoFNLtPuigwmg8Gdu5zX7pG4pDqTfR7CQWxdxV8jz8Z",
      "9fGsHJ6Es3NkESbUQZDNP9qzzFmtZ34NkFDpVP1HbZaAFKmh46k",
      "9gbSaqNZ8ejUPXbgyPxqErPeEQxNExqCaEpWTPorqeopeqMfZSJ",
      "9gou6W7jbuF7ZGvftYBvApNd4ajFeViNFcGYNBr6gdDr4shhVqS",
      "9fkPhGVtUF4xszuxx3SH5RiMhtDxKe67WBunzn83DMYBFhBT8cS",
      "9h8zyQcw5voWCuDKw2ysNW9Gmx2hPozpKhJWHktVbKcGt2kdMV3",
      "9iJiuRD55cbaocffm5ZNHpMpy5dm52zTb5iVTbC2yj8smYAHMG1",
      "9gALM3AFz1bPWuZK415grHrYjdNdUxbSqJzDrWtSyEUB9cg25tZ",
      "9gXCe77G3txmNt7pf91DxUpUDFMAtMV87p9ae7ms7SUW8aDXGZU",
      "9htLPwiQkHd6g9YzbCWEceea82A2pUYEPiLFdUoLFd6yj2g2M1T",
      "9gorgCtfxi8d1HAcT4YUoi92arfELmRwY4VpoND1M9peZtVJRwr",
      "9fDFYKNKWVeXAS4qZ6HHeNUnuzEDNw33eAQXUZQ6g2LEWBNaWzp",
      "9ebqYcYxUqun5gAPiBB2uTDjsjTrTFi7rsEegM9zKyf9n5mmjcw",
      "9hxRZQjVcYVooutWZSz831z9TTsxrMdToJRkt9GmPiSZu3PpZQg",
      "9eXDd1WufjwZCzCwd4cjL3y6sdt3apWV1LYum9jvWyFhJ1AiUQR"
    ];

    for (let i = 0; i < validAddresses.length; i++) {
      const address = bip32.deriveAddress(i);
      expect(address.script).toEqual(validAddresses[i]);
    }
  });
});
