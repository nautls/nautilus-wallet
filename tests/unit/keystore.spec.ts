import { hex } from "@fleet-sdk/crypto";
import { describe, expect, it } from "vitest";
import { PasswordError } from "@/common/errors";
import {
  decryptSecret,
  EncryptedSecretV2,
  encryptSecret,
  fromLegacyCiphertext,
  needsUpgrade,
  PBKDF2_ITERATIONS
} from "@/common/keystore";

describe("keystore", () => {
  const mnemonic =
    "fade payment weasel market mixed armed decade shed harbor bind deal mandate pink earth second";
  const password = "correct horse battery";
  const publicKey = "02" + "11".repeat(32);
  const otherPublicKey = "03" + "22".repeat(32);

  // produced by `AES.encrypt(mnemonic, password).toString()` from crypto-js
  const legacyCiphertext =
    "U2FsdGVkX18UzwO9k37iXcUw5UeCoRnx6tne+hT5Z1+CT56IOYoAu4adRris+NecYR6DzSzCRgXXu0/wSOEg2hrb/CZfJVJS29oM4T2QeMPCwg8SjJ3tdi5C5KF4idZKQMuRdym1oJEWdRbo2YDtWw==";

  describe("v1 (legacy crypto-js)", () => {
    it("decrypts legacy ciphertexts", async () => {
      const encrypted = fromLegacyCiphertext(legacyCiphertext);

      expect(encrypted).toEqual({ version: 1, ciphertext: legacyCiphertext });
      expect(await decryptSecret(encrypted, password, publicKey)).toBe(mnemonic);
    });

    it("throws PasswordError on wrong password", async () => {
      const encrypted = fromLegacyCiphertext(legacyCiphertext);
      await expect(decryptSecret(encrypted, "wrong password", publicKey)).rejects.toThrow(
        PasswordError
      );
    });

    it("needs an upgrade", () => {
      expect(needsUpgrade(fromLegacyCiphertext(legacyCiphertext))).toBe(true);
    });
  });

  describe("v2", () => {
    it("round-trips a secret", async () => {
      const encrypted = await encryptSecret(mnemonic, password, publicKey);
      expect(await decryptSecret(encrypted, password, publicKey)).toBe(mnemonic);
    });

    it("writes hex fields, PBKDF2 at the current iterations and no plaintext", async () => {
      const encrypted = await encryptSecret(mnemonic, password, publicKey);
      const isHex = (s: string, bytes?: number) =>
        /^([0-9a-f]{2})+$/.test(s) && (bytes === undefined || s.length === bytes * 2);

      expect(encrypted.version).toBe(2);
      expect(encrypted.wrappedKey).toEqual({
        by: "password",
        kdf: { name: "pbkdf2", salt: expect.any(String), iterations: PBKDF2_ITERATIONS },
        iv: expect.any(String),
        ciphertext: expect.any(String)
      });
      expect(PBKDF2_ITERATIONS).toBe(600_000);
      expect(isHex(encrypted.wrappedKey.kdf.salt, 16)).toBe(true);
      expect(isHex(encrypted.wrappedKey.iv, 12)).toBe(true);
      expect(isHex(encrypted.iv, 12)).toBe(true);
      expect(isHex(encrypted.wrappedKey.ciphertext, 32 + 16)).toBe(true); // key + GCM tag
      expect(isHex(encrypted.ciphertext)).toBe(true);
      expect(JSON.stringify(encrypted)).not.toContain("fade");
      expect(needsUpgrade(encrypted)).toBe(false);
    });

    it("uses a fresh salt, IVs and wallet key every time", async () => {
      const [a, b] = await Promise.all([
        encryptSecret(mnemonic, password, publicKey),
        encryptSecret(mnemonic, password, publicKey)
      ]);

      expect(a.wrappedKey.kdf.salt).not.toBe(b.wrappedKey.kdf.salt);
      expect(a.wrappedKey.iv).not.toBe(b.wrappedKey.iv);
      expect(a.iv).not.toBe(b.iv);
      expect(a.ciphertext).not.toBe(b.ciphertext);
    });

    it("throws PasswordError on wrong password", async () => {
      const encrypted = await encryptSecret(mnemonic, password, publicKey);
      await expect(decryptSecret(encrypted, "wrong password", publicKey)).rejects.toThrow(
        PasswordError
      );
    });

    it("doesn't decrypt for another wallet's public key", async () => {
      const encrypted = await encryptSecret(mnemonic, password, publicKey);
      await expect(decryptSecret(encrypted, password, otherPublicKey)).rejects.toThrow();
    });

    it("binds to the public key bytes, not the hex string", async () => {
      const encrypted = await encryptSecret(mnemonic, password, publicKey);
      const upper = hex.encode(hex.decode(publicKey)).toUpperCase();
      expect(await decryptSecret(encrypted, password, upper)).toBe(mnemonic);
    });

    it("reports a damaged secret as corruption, not a wrong password", async () => {
      const encrypted = await encryptSecret(mnemonic, password, publicKey);
      const flipped = (encrypted.ciphertext[0] === "0" ? "1" : "0") + encrypted.ciphertext.slice(1);
      const damaged: EncryptedSecretV2 = { ...encrypted, ciphertext: flipped };

      const error = await decryptSecret(damaged, password, publicKey).catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(PasswordError);
      expect(error.message).toMatch(/corrupted/);
    });

    it("needs an upgrade when below the current iterations", async () => {
      const encrypted = await encryptSecret(mnemonic, password, publicKey);
      const weaker: EncryptedSecretV2 = {
        ...encrypted,
        wrappedKey: {
          ...encrypted.wrappedKey,
          kdf: { ...encrypted.wrappedKey.kdf, iterations: 100_000 }
        }
      };

      expect(needsUpgrade(weaker)).toBe(true);
    });
  });

  it("rejects unknown scheme versions", async () => {
    const encrypted = { version: 99 } as unknown as Parameters<typeof decryptSecret>[0];
    await expect(decryptSecret(encrypted, password, publicKey)).rejects.toThrow(/unsupported/);
  });
});
