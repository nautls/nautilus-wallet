import { isEmpty } from "@fleet-sdk/common";
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

/**
 * Encrypted secret. `version` fully defines the cipher and key derivation, so records
 * only hold what varies between them (ciphertext, salt, nonce, tunable KDF params).
 * Each new scheme gets a new `version` and is added to this union, so data encrypted
 * with older schemes can still be read.
 */
export type EncryptedSecret = EncryptedSecretV1;

export function fromLegacyCiphertext(ciphertext: string): EncryptedSecretV1 {
  return { version: 1, ciphertext };
}

export async function encryptSecret(secret: string, password: string): Promise<EncryptedSecret> {
  const encrypted = fromLegacyCiphertext(AES.encrypt(secret, password).toString());
  if ((await decryptSecret(encrypted, password)) !== secret) {
    throw Error("failed to encrypt the secret");
  }

  return encrypted;
}

/**
 * @throws {PasswordError} if the password is wrong.
 */
export async function decryptSecret(encrypted: EncryptedSecret, password: string): Promise<string> {
  switch (encrypted.version) {
    case 1:
      return decryptV1(encrypted, password);
    default:
      throw Error(
        `unsupported encryption scheme version: ${(encrypted as EncryptedSecret).version}`
      );
  }
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
