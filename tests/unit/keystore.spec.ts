import { hex } from "@fleet-sdk/crypto";
import { describe, expect, it } from "vitest";
import { PasswordError } from "@/common/errors";
import {
  decryptSecret,
  EncryptedSecretV2,
  encryptSecret,
  fromLegacyCiphertext,
  needsUpgrade,
  createMasterKey,
  MasterKeyRecord,
  PBKDF2_ITERATIONS,
  unlockMasterKey
} from "@/common/keystore";

describe("keystore", () => {
  const mnemonic =
    "fade payment weasel market mixed armed decade shed harbor bind deal mandate pink earth second";
  const password = "correct horse battery";
  const publicKey = "02" + "11".repeat(32);
  const otherPublicKey = "03" + "22".repeat(32);

  const encryptWithPassword = () =>
    encryptSecret(mnemonic, publicKey, { by: "password", password });
  const kdfOf = (encrypted: EncryptedSecretV2) => {
    if (encrypted.wrappedKey.by !== "password") throw Error("not password-protected");
    return encrypted.wrappedKey.kdf;
  };

  // produced by `AES.encrypt(mnemonic, password).toString()` from crypto-js
  const legacyCiphertext =
    "U2FsdGVkX18UzwO9k37iXcUw5UeCoRnx6tne+hT5Z1+CT56IOYoAu4adRris+NecYR6DzSzCRgXXu0/wSOEg2hrb/CZfJVJS29oM4T2QeMPCwg8SjJ3tdi5C5KF4idZKQMuRdym1oJEWdRbo2YDtWw==";

  describe("v1 (legacy crypto-js)", () => {
    it("decrypts legacy ciphertexts", async () => {
      const encrypted = fromLegacyCiphertext(legacyCiphertext);

      expect(encrypted).toEqual({ version: 1, ciphertext: legacyCiphertext });
      expect(await decryptSecret(encrypted, publicKey, password)).toBe(mnemonic);
    });

    it("throws PasswordError on wrong password", async () => {
      const encrypted = fromLegacyCiphertext(legacyCiphertext);
      await expect(decryptSecret(encrypted, publicKey, "wrong password")).rejects.toThrow(
        PasswordError
      );
    });

    it("needs an upgrade", () => {
      expect(needsUpgrade(fromLegacyCiphertext(legacyCiphertext))).toBe(true);
    });
  });

  describe("v2", () => {
    it("round-trips a secret", async () => {
      const encrypted = await encryptWithPassword();
      expect(await decryptSecret(encrypted, publicKey, password)).toBe(mnemonic);
    });

    it("writes hex fields, PBKDF2 at the current iterations and no plaintext", async () => {
      const encrypted = await encryptWithPassword();
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
      expect(isHex(kdfOf(encrypted).salt, 16)).toBe(true);
      expect(isHex(encrypted.wrappedKey.iv, 12)).toBe(true);
      expect(isHex(encrypted.iv, 12)).toBe(true);
      expect(isHex(encrypted.wrappedKey.ciphertext, 32 + 16)).toBe(true); // key + GCM tag
      expect(isHex(encrypted.ciphertext)).toBe(true);
      expect(JSON.stringify(encrypted)).not.toContain("fade");
      expect(needsUpgrade(encrypted)).toBe(false);
    });

    it("uses a fresh salt, IVs and wallet key every time", async () => {
      const [a, b] = await Promise.all([encryptWithPassword(), encryptWithPassword()]);

      expect(kdfOf(a).salt).not.toBe(kdfOf(b).salt);
      expect(a.wrappedKey.iv).not.toBe(b.wrappedKey.iv);
      expect(a.iv).not.toBe(b.iv);
      expect(a.ciphertext).not.toBe(b.ciphertext);
    });

    it("throws PasswordError on wrong password", async () => {
      const encrypted = await encryptWithPassword();
      await expect(decryptSecret(encrypted, publicKey, "wrong password")).rejects.toThrow(
        PasswordError
      );
    });

    it("doesn't decrypt for another wallet's public key", async () => {
      const encrypted = await encryptWithPassword();
      await expect(decryptSecret(encrypted, otherPublicKey, password)).rejects.toThrow();
    });

    it("binds to the public key bytes, not the hex string", async () => {
      const encrypted = await encryptWithPassword();
      const upper = hex.encode(hex.decode(publicKey)).toUpperCase();
      expect(await decryptSecret(encrypted, upper, password)).toBe(mnemonic);
    });

    it("reports a damaged secret as corruption, not a wrong password", async () => {
      const encrypted = await encryptWithPassword();
      const flipped = (encrypted.ciphertext[0] === "0" ? "1" : "0") + encrypted.ciphertext.slice(1);
      const damaged: EncryptedSecretV2 = { ...encrypted, ciphertext: flipped };

      const error = await decryptSecret(damaged, publicKey, password).catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(PasswordError);
      expect(error.message).toMatch(/corrupted/);
    });

    it("needs an upgrade when below the current iterations", async () => {
      const encrypted = await encryptWithPassword();
      const weaker: EncryptedSecretV2 = {
        ...encrypted,
        wrappedKey: {
          ...encrypted.wrappedKey,
          by: "password",
          kdf: { ...kdfOf(encrypted), iterations: 100_000 }
        }
      };

      expect(needsUpgrade(weaker)).toBe(true);
    });

    describe("password normalization", () => {
      const composed = "café ñandú 12"; // precomposed é, ñ, ú
      const decomposed = composed.normalize("NFD"); // e, n, u + combining marks

      it("derives the same key from either form of the same password", async () => {
        expect(decomposed).not.toBe(composed);
        const encrypted = await encryptSecret(mnemonic, publicKey, {
          by: "password",
          password: composed
        });

        expect(await decryptSecret(encrypted, publicKey, composed)).toBe(mnemonic);
        expect(await decryptSecret(encrypted, publicKey, decomposed)).toBe(mnemonic);
      });

      it("treats fullwidth characters from IMEs as their ASCII forms", async () => {
        const encrypted = await encryptSecret(mnemonic, publicKey, {
          by: "password",
          password: "ｐａｓｓｗｏｒｄ １２３"
        });

        expect(await decryptSecret(encrypted, publicKey, "password 123")).toBe(mnemonic);
      });

      it("applies to the master password", async () => {
        const { record } = await createMasterKey(composed);
        await expect(unlockMasterKey(record, decomposed)).resolves.toBeDefined();
      });
    });
  });

  describe("master key", () => {
    const masterPassword = "master password 123";

    it("creates a record that verifies the master password", async () => {
      const { record } = await createMasterKey(masterPassword);

      expect(record).toEqual({
        version: 2,
        kdf: { name: "pbkdf2", salt: expect.any(String), iterations: PBKDF2_ITERATIONS },
        wrappedKey: { iv: expect.any(String), ciphertext: expect.any(String) }
      });
      await expect(unlockMasterKey(record, masterPassword)).resolves.toBeDefined();
      await expect(unlockMasterKey(record, "wrong password")).rejects.toThrow(PasswordError);
    });

    it("round-trips a secret with the master password", async () => {
      const { record, masterKey } = await createMasterKey(masterPassword);
      const encrypted = await encryptSecret(mnemonic, publicKey, { by: "master", masterKey });

      expect(encrypted.wrappedKey).toEqual({
        by: "master",
        iv: expect.any(String),
        ciphertext: expect.any(String)
      });
      expect(needsUpgrade(encrypted)).toBe(false);
      expect(await decryptSecret(encrypted, publicKey, masterPassword, record)).toBe(mnemonic);
      await expect(decryptSecret(encrypted, publicKey, "wrong password", record)).rejects.toThrow(
        PasswordError
      );
    });

    it("unlocks a secret with the same master key after unlocking again", async () => {
      const { record } = await createMasterKey(masterPassword);
      const masterKey = await unlockMasterKey(record, masterPassword);
      const encrypted = await encryptSecret(mnemonic, publicKey, { by: "master", masterKey });

      expect(await decryptSecret(encrypted, publicKey, masterPassword, record)).toBe(mnemonic);
    });

    it("doesn't decrypt with another install's master key", async () => {
      const { masterKey } = await createMasterKey(masterPassword);
      const { record: other } = await createMasterKey(masterPassword);
      const encrypted = await encryptSecret(mnemonic, publicKey, { by: "master", masterKey });

      await expect(decryptSecret(encrypted, publicKey, masterPassword, other)).rejects.toThrow(
        PasswordError
      );
    });

    it("doesn't decrypt for another wallet's public key", async () => {
      const { record, masterKey } = await createMasterKey(masterPassword);
      const encrypted = await encryptSecret(mnemonic, publicKey, { by: "master", masterKey });

      await expect(
        decryptSecret(encrypted, otherPublicKey, masterPassword, record)
      ).rejects.toThrow();
    });

    it("requires the master record", async () => {
      const { masterKey } = await createMasterKey(masterPassword);
      const encrypted = await encryptSecret(mnemonic, publicKey, { by: "master", masterKey });

      await expect(decryptSecret(encrypted, publicKey, masterPassword)).rejects.toThrow(
        /isn't set up/
      );
    });

    it("rejects unknown master record versions", async () => {
      const { record } = await createMasterKey(masterPassword);
      const future = { ...record, version: 3 } as unknown as MasterKeyRecord;
      await expect(unlockMasterKey(future, masterPassword)).rejects.toThrow(/unsupported/);
    });
  });

  it("rejects unknown scheme versions", async () => {
    const encrypted = { version: 99 } as unknown as Parameters<typeof decryptSecret>[0];
    await expect(decryptSecret(encrypted, publicKey, password)).rejects.toThrow(/unsupported/);
  });
});
