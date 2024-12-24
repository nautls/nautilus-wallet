import { base58check, hex } from "@fleet-sdk/crypto";
import { ErgoHDKey } from "@fleet-sdk/wallet";
import { NETWORK } from "@/constants/ergo";

export type IndexedAddress = { index: number; script: string };
type PublicKeyOptions = string | { publicKey: string; chainCode: string };

export default class HdKey {
  #change!: ErgoHDKey;
  #xpk!: Uint8Array;

  private constructor(key: ErgoHDKey, derivationPath?: string) {
    if (!key.privateKey) {
      this.#change = derivationPath ? key.derive(derivationPath) : key;
    } else {
      this.#change = key;
    }
  }

  public neutered(): HdKey {
    if (!this.#change.privateKey) return this;
    this.#change.wipePrivateData();

    return this;
  }

  public static async fromMnemonic(mnemonic: string): Promise<HdKey> {
    return new this(await ErgoHDKey.fromMnemonic(mnemonic));
  }

  public static fromPublicKey(key: PublicKeyOptions, path?: string): HdKey {
    if (typeof key === "string") {
      return new this(ErgoHDKey.fromExtendedKey(key));
    }

    const opt = { publicKey: hex.decode(key.publicKey), chainCode: hex.decode(key.chainCode) };
    return new this(new ErgoHDKey(opt), path);
  }

  public get privateKey(): Uint8Array | undefined {
    return this.#change.privateKey;
  }

  public get publicKey(): Uint8Array {
    return this.#change.publicKey;
  }

  public get chainCode(): Uint8Array {
    return this.#change.chainCode as Uint8Array;
  }

  public get extendedPublicKey(): Uint8Array {
    if (!this.#xpk) {
      const decoded = base58check.decode(this.#change.extendedPublicKey);
      this.#xpk = this.normalizeExtendedKey(decoded);
    }

    return this.#xpk;
  }

  /**
   * Removes fingerprint, and child number from the extended key,
   * it was necessary for Yoroi compatibility and kept to avoid
   * breaking changes.
   */
  private normalizeExtendedKey(key: Uint8Array) {
    return key.fill(0, 4, 12);
  }

  public derivePrivateKey(index: number): Uint8Array {
    const sk = this.#change.deriveChild(index).privateKey;
    if (!sk) throw Error("private key not found.");

    return sk;
  }

  public deriveAddress(index: number): IndexedAddress {
    const script = this.#change.deriveChild(index).address.encode(NETWORK);
    return { index, script };
  }

  public deriveAddresses(count: number, offset = 0): IndexedAddress[] {
    const addresses: IndexedAddress[] = [];
    for (let i = offset; i < count + offset; i++) {
      addresses.push(this.deriveAddress(i));
    }

    return addresses;
  }
}
