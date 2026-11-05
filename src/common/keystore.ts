import { isEmpty } from "@fleet-sdk/common";
import { hex, utf8 } from "@fleet-sdk/crypto";
import AES from "crypto-js/aes";
import utf8Enc from "crypto-js/enc-utf8";
import { PasswordError } from "@/common/errors";

/**
 * Legacy CryptoJS `AES.encrypt(secret, password)` output: AES-256-CBC, key and IV
 * derived with OpenSSL's EVP_BytesToKey (one round of MD5), no authentication.
 * `ciphertext` is the OpenSSL "Salted__" format, base64 encoded, salt included.
 */
export type EncryptedSecretV1 = {
  version: 1;
  ciphertext: string;
};

export type Pbkdf2Params = {
  name: "pbkdf2";
  salt: string;
  iterations: number;
};

/** A random key, AES-256-GCM encrypted under another key. */
export type WrappedKey = { iv: string; ciphertext: string };

/**
 * Crypto scheme version v2
 *
 * Cipher: AES-256-GCM
 * Key wrapping: a random wallet key encrypts the secret, and is itself wrapped
 * either by a key derived from the wallet's own password, or by the master key
 */
export type EncryptedSecretV2 = {
  version: 2;
  wrappedKey:
    ({ by: "password"; kdf: Pbkdf2Params } & WrappedKey) | ({ by: "master" } & WrappedKey);
  iv: string;
  ciphertext: string;
};

export type MasterKeyRecord = {
  version: 2;
  kdf: Pbkdf2Params;
  wrappedKey: WrappedKey;
};

/**
 * Encrypted secret. `version` fully defines the cipher and key derivation, so records
 * only hold what varies between them (ciphertext, salt, nonce, tunable KDF params).
 * Each new scheme gets a new `version` and is added to this union, so data encrypted
 * with older schemes can still be read.
 */
export type EncryptedSecret = EncryptedSecretV1 | EncryptedSecretV2;

export type SecretProtection =
  { by: "password"; password: string } | { by: "master"; masterKey: MasterKey };

declare const masterKeyBrand: unique symbol;
export type MasterKey = CryptoKey & { [masterKeyBrand]: true };

/** OWASP's current recommendation for PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000;

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const MASTER_KEY_AAD = utf8.decode("nautilus:master-key");

export function fromLegacyCiphertext(ciphertext: string): EncryptedSecretV1 {
  return { version: 1, ciphertext };
}

export async function createMasterKey(
  password: string
): Promise<{ record: MasterKeyRecord; masterKey: MasterKey }> {
  const kdf = newKdfParams();
  const passwordKey = await derivePasswordKey(password, kdf);
  const raw = randomBytes(KEY_LENGTH);

  try {
    const record: MasterKeyRecord = {
      version: 2,
      kdf,
      wrappedKey: await gcmEncrypt(passwordKey, raw, MASTER_KEY_AAD)
    };
    const masterKey = await unwrapMasterKey(record, passwordKey);

    return { record, masterKey };
  } finally {
    raw.fill(0);
  }
}

export async function unlockMasterKey(
  record: MasterKeyRecord,
  password: string
): Promise<MasterKey> {
  if (record.version !== 2) throw Error(`unsupported master key version: ${record.version}`);
  return unwrapMasterKey(record, await derivePasswordKey(password, record.kdf));
}

/**
 * Encrypts `secret` with the current scheme.
 */
export async function encryptSecret(
  secret: string,
  publicKey: string,
  protection: SecretProtection
): Promise<EncryptedSecretV2> {
  const aad = hex.decode(publicKey);
  const walletKey = randomBytes(KEY_LENGTH);

  let wrappingKey: CryptoKey;
  let by: { by: "password"; kdf: Pbkdf2Params } | { by: "master" };
  if (protection.by === "password") {
    const kdf = newKdfParams();
    wrappingKey = await derivePasswordKey(protection.password, kdf);
    by = { by: "password", kdf };
  } else {
    wrappingKey = protection.masterKey;
    by = { by: "master" };
  }

  try {
    const wrapped = await gcmEncrypt(wrappingKey, walletKey, aad);
    const sealed = await gcmEncrypt(await importAesKey(walletKey), utf8.decode(secret), aad);
    const encrypted: EncryptedSecretV2 = {
      version: 2,
      wrappedKey: { ...by, ...wrapped },
      iv: sealed.iv,
      ciphertext: sealed.ciphertext
    };

    // check with the key in hand, rather than paying for the KDF again
    if ((await decryptV2WithKey(encrypted, wrappingKey, aad)) !== secret) {
      throw Error("failed to encrypt the secret");
    }

    return encrypted;
  } finally {
    walletKey.fill(0);
  }
}

/**
 * @param password the wallet's own password, or the master password for secrets
 * protected by the master key, in which case `master` is required.
 * @throws {PasswordError} if the password is wrong.
 */
export async function decryptSecret(
  encrypted: EncryptedSecret,
  publicKey: string,
  password: string,
  master?: MasterKeyRecord
): Promise<string> {
  switch (encrypted.version) {
    case 1:
      return decryptV1(encrypted, password);
    case 2:
      return decryptV2(encrypted, publicKey, password, master);
    default:
      throw Error(
        `unsupported encryption scheme version: ${(encrypted as EncryptedSecret).version}`
      );
  }
}

export function needsUpgrade(encrypted: EncryptedSecret): boolean {
  if (encrypted.version === 1) return true;
  return (
    encrypted.wrappedKey.by === "password" &&
    encrypted.wrappedKey.kdf.iterations < PBKDF2_ITERATIONS
  );
}

function decryptV1(encrypted: EncryptedSecretV1, password: string): string {
  let secret: string;
  try {
    secret = AES.decrypt(encrypted.ciphertext, password).toString(utf8Enc);
  } catch {
    throw new PasswordError();
  }

  if (isEmpty(secret)) throw new PasswordError();
  return secret;
}

async function decryptV2(
  encrypted: EncryptedSecretV2,
  publicKey: string,
  password: string,
  master?: MasterKeyRecord
): Promise<string> {
  const aad = hex.decode(publicKey);
  if (encrypted.wrappedKey.by === "master") {
    if (!master) throw Error("the master password isn't set up");
    return decryptV2WithKey(encrypted, await unlockMasterKey(master, password), aad);
  }

  const passwordKey = await derivePasswordKey(password, encrypted.wrappedKey.kdf);
  return decryptV2WithKey(encrypted, passwordKey, aad);
}

async function decryptV2WithKey(
  encrypted: EncryptedSecretV2,
  wrappingKey: CryptoKey,
  aad: Uint8Array
): Promise<string> {
  let walletKey: Uint8Array;
  try {
    walletKey = await gcmDecrypt(
      wrappingKey,
      encrypted.wrappedKey.iv,
      encrypted.wrappedKey.ciphertext,
      aad
    );
  } catch {
    throw new PasswordError();
  }

  try {
    const secret = await gcmDecrypt(
      await importAesKey(walletKey),
      encrypted.iv,
      encrypted.ciphertext,
      aad
    );
    return utf8.encode(secret);
  } catch {
    // the password was right, so the record itself is damaged or doesn't belong here
    throw Error("failed to decrypt the secret: the record is corrupted");
  } finally {
    walletKey.fill(0);
  }
}

async function unwrapMasterKey(
  record: MasterKeyRecord,
  passwordKey: CryptoKey
): Promise<MasterKey> {
  let raw: Uint8Array;
  try {
    raw = await gcmDecrypt(
      passwordKey,
      record.wrappedKey.iv,
      record.wrappedKey.ciphertext,
      MASTER_KEY_AAD
    );
  } catch {
    throw new PasswordError();
  }

  try {
    return (await importAesKey(raw)) as MasterKey;
  } finally {
    raw.fill(0);
  }
}

function newKdfParams(): Pbkdf2Params {
  return {
    name: "pbkdf2",
    salt: hex.encode(randomBytes(SALT_LENGTH)),
    iterations: PBKDF2_ITERATIONS
  };
}

async function derivePasswordKey(password: string, kdf: Pbkdf2Params): Promise<CryptoKey> {
  if (kdf.name !== "pbkdf2") throw Error(`unsupported key derivation: ${kdf.name}`);

  // the same password typed as different code points must derive the same key: a
  // precomposed "é" or "e" plus a combining accent, fullwidth "１" from an IME or "1"
  const normalizedBytes = bytes(utf8.decode(password.normalize("NFKC")));
  const material = await crypto.subtle.importKey("raw", normalizedBytes, "PBKDF2", false, [
    "deriveKey"
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: bytes(hex.decode(kdf.salt)),
      iterations: kdf.iterations
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", bytes(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function gcmEncrypt(key: CryptoKey, plaintext: Uint8Array, aad: Uint8Array) {
  const iv = randomBytes(IV_LENGTH);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: bytes(aad) },
    key,
    bytes(plaintext)
  );

  return { iv: hex.encode(iv), ciphertext: hex.encode(new Uint8Array(ciphertext)) };
}

async function gcmDecrypt(
  key: CryptoKey,
  iv: string,
  ciphertext: string,
  aad: Uint8Array
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(hex.decode(iv)), additionalData: bytes(aad) },
    key,
    bytes(hex.decode(ciphertext))
  );

  return new Uint8Array(plaintext);
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

function bytes(data: Uint8Array): Uint8Array<ArrayBuffer> {
  return data.buffer instanceof ArrayBuffer
    ? (data as Uint8Array<ArrayBuffer>)
    : new Uint8Array(data);
}
