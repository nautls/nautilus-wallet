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

/**
 * AES-256-GCM
 * Envelope encryption: A random wallet key encrypts the secret, and is itself wrapped
 * by a key derived from the password (`wrappedKey.by`).
 */
export type EncryptedSecretV2 = {
  version: 2;
  /** The wallet key, AES-GCM under the key named by `by`. */
  wrappedKey: { by: "password"; kdf: Pbkdf2Params; iv: string; ciphertext: string };
  iv: string;
  ciphertext: string;
};

/**
 * Encrypted secret. `version` fully defines the cipher and key derivation, so records
 * only hold what varies between them (ciphertext, salt, nonce, tunable KDF params).
 * Each new scheme gets a new `version` and is added to this union, so data encrypted
 * with older schemes can still be read.
 */
export type EncryptedSecret = EncryptedSecretV1 | EncryptedSecretV2;

/** OWASP's current recommendation for PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000;

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export function fromLegacyCiphertext(ciphertext: string): EncryptedSecretV1 {
  return { version: 1, ciphertext };
}

/**
 * Encrypts `secret` with the current scheme.
 */
export async function encryptSecret(
  secret: string,
  password: string,
  publicKey: string
): Promise<EncryptedSecretV2> {
  const aad = hex.decode(publicKey);
  const kdf: Pbkdf2Params = {
    name: "pbkdf2",
    salt: hex.encode(randomBytes(SALT_LENGTH)),
    iterations: PBKDF2_ITERATIONS
  };
  const passwordKey = await derivePasswordKey(password, kdf);
  const walletKey = randomBytes(KEY_LENGTH);

  try {
    const wrapped = await gcmEncrypt(passwordKey, walletKey, aad);
    const sealed = await gcmEncrypt(await importAesKey(walletKey), utf8.decode(secret), aad);
    const encrypted: EncryptedSecretV2 = {
      version: 2,
      wrappedKey: { by: "password", kdf, ...wrapped },
      iv: sealed.iv,
      ciphertext: sealed.ciphertext
    };

    // check with the key just derived, rather than paying for the KDF again
    if ((await decryptV2WithKey(encrypted, passwordKey, aad)) !== secret) {
      throw Error("failed to encrypt the secret");
    }

    return encrypted;
  } finally {
    walletKey.fill(0);
  }
}

export async function decryptSecret(
  encrypted: EncryptedSecret,
  password: string,
  publicKey: string
): Promise<string> {
  switch (encrypted.version) {
    case 1:
      return decryptV1(encrypted, password);
    case 2:
      return decryptV2(encrypted, password, publicKey);
    default:
      throw Error(
        `unsupported encryption scheme version: ${(encrypted as EncryptedSecret).version}`
      );
  }
}

export function needsUpgrade(encrypted: EncryptedSecret): boolean {
  return encrypted.version === 1 || encrypted.wrappedKey.kdf.iterations < PBKDF2_ITERATIONS;
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
  password: string,
  publicKey: string
): Promise<string> {
  const passwordKey = await derivePasswordKey(password, encrypted.wrappedKey.kdf);
  return decryptV2WithKey(encrypted, passwordKey, hex.decode(publicKey));
}

async function decryptV2WithKey(
  encrypted: EncryptedSecretV2,
  passwordKey: CryptoKey,
  aad: Uint8Array
): Promise<string> {
  let walletKey: Uint8Array;
  try {
    walletKey = await gcmDecrypt(
      passwordKey,
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

async function derivePasswordKey(password: string, kdf: Pbkdf2Params): Promise<CryptoKey> {
  if (kdf.name !== "pbkdf2") throw Error(`unsupported key derivation: ${kdf.name}`);

  const material = await crypto.subtle.importKey(
    "raw",
    bytes(utf8.decode(password)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

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
