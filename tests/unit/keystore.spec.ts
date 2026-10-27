import { describe, expect, it } from "vitest";
import { PasswordError } from "@/common/errors";
import { decryptSecret, encryptSecret, fromLegacyCiphertext } from "@/common/keystore";

describe("keystore", () => {
  const mnemonic =
    "fade payment weasel market mixed armed decade shed harbor bind deal mandate pink earth second";
  const password = "correct horse battery";

  // produced by `AES.encrypt(mnemonic, password).toString()` from crypto-js
  const legacyCiphertext =
    "U2FsdGVkX18UzwO9k37iXcUw5UeCoRnx6tne+hT5Z1+CT56IOYoAu4adRris+NecYR6DzSzCRgXXu0/wSOEg2hrb/CZfJVJS29oM4T2QeMPCwg8SjJ3tdi5C5KF4idZKQMuRdym1oJEWdRbo2YDtWw==";

  it("decrypts legacy crypto-js ciphertexts", async () => {
    const encrypted = fromLegacyCiphertext(legacyCiphertext);

    expect(encrypted).toEqual({
      version: 1,
      ciphertext: legacyCiphertext
    });
    expect(await decryptSecret(encrypted, password)).toBe(mnemonic);
  });

  it("round-trips a secret", async () => {
    const encrypted = await encryptSecret(mnemonic, password);
    expect(await decryptSecret(encrypted, password)).toBe(mnemonic);
  });

  it("throws PasswordError on wrong password", async () => {
    const encrypted = fromLegacyCiphertext(legacyCiphertext);
    await expect(decryptSecret(encrypted, "wrong password")).rejects.toThrow(PasswordError);
  });

  it("rejects unknown scheme versions", async () => {
    const encrypted = { version: 99 } as unknown as Parameters<typeof decryptSecret>[0];
    await expect(decryptSecret(encrypted, password)).rejects.toThrow(/unsupported/);
  });
});
