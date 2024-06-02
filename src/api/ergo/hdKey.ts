import { NETWORK } from "@/constants/ergo";
import { ErgoHDKey } from "@fleet-sdk/wallet";
import { hex } from "@fleet-sdk/crypto";
import { base58check } from "@fleet-sdk/crypto";

export type DerivedAddress = { index: number; script: string };

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

  public static fromPublicKey(
    key: string | { publicKey: string; chainCode: string },
    derivationPath?: string
  ): HdKey {
    if (typeof key === "string") {
      const encoded = base58check.encode(hex.decode(key));
      return new this(ErgoHDKey.fromExtendedKey(encoded));
    } else {
      return new this(
        ErgoHDKey.fromExtendedKey({
          publicKey: hex.decode(key.publicKey),
          chainCode: hex.decode(key.chainCode)
        }),
        derivationPath
      );
    }
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
      this.#xpk = this.normalizeExtendedKey(base58check.decode(this.#change.extendedPublicKey));
    }

    return this.#xpk;
  }

  private normalizeExtendedKey(key: Uint8Array) {
    return key.fill(0, 4, 12);
  }

  public derivePrivateKey(index: number): Uint8Array {
    const sk = this.#change.deriveChild(index).privateKey;
    if (!sk) throw Error("private key not found.");

    return sk;
  }

  public deriveAddress(index: number): DerivedAddress {
    const script = this.#change.deriveChild(index).address.encode(NETWORK);
    return { index, script };
  }

  public deriveAddresses(count: number, offset = 0): DerivedAddress[] {
    const addresses: DerivedAddress[] = [];
    for (let i = offset; i < count + offset; i++) {
      addresses.push(this.deriveAddress(i));
    }

    return addresses;
  }
}
