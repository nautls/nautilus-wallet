import BIP32Factory, { BIP32Interface } from "bip32";
import * as ecc from "tiny-secp256k1";
import { Address } from "@coinbarn/ergo-ts";
import { DERIVATION_PATH } from "@/constants/ergo";
import bs58check from "bs58check";

const bip32 = BIP32Factory(ecc);

export type DerivedAddress = {
  index: number;
  script: string;
};

export default class Bip32 {
  private _change!: BIP32Interface;
  private _extendedPk!: Buffer;

  private constructor(bip32: BIP32Interface, isRootPath = false) {
    if (bip32.isNeutered() || isRootPath) {
      this._change = bip32;
    } else {
      this._change = bip32.derivePath(DERIVATION_PATH);
    }
  }

  public static fromSeed(seed: Buffer): Bip32 {
    return new this(bip32.fromSeed(seed));
  }

  public static fromPublicKey(publicKey: string | { publicKey: string; chainCode: string }): Bip32 {
    if (typeof publicKey === "string") {
      const buffer = Buffer.from(publicKey, "hex");
      return new this(bip32.fromPublicKey(buffer.slice(45, 78), buffer.slice(13, 45)));
    } else {
      return new this(
        bip32.fromPublicKey(
          Buffer.from(publicKey.publicKey, "hex"),
          Buffer.from(publicKey.chainCode, "hex")
        )
      );
    }
  }

  public static fromPrivateKey(privateKey: string, chainCode: string): Bip32 {
    return new this(
      bip32.fromPrivateKey(Buffer.from(privateKey, "hex"), Buffer.from(chainCode, "hex")),
      true
    );
  }

  public get privateKey(): Buffer | undefined {
    return this._change.privateKey;
  }

  public get publicKey(): Buffer {
    return this._change.publicKey;
  }

  public get chainCode(): Buffer {
    return this._change.chainCode;
  }

  public get extendedPublicKey(): Buffer {
    if (!this._extendedPk) {
      this._extendedPk = this.normalize(bs58check.decode(this._change.neutered().toBase58()));
    }

    return this._extendedPk;
  }

  private normalize(key: Buffer) {
    return key.fill(0, 4, 12);
  }

  public derivePrivateKey(index: number): Buffer | undefined {
    return this._change.derive(index).privateKey;
  }

  public deriveAddress(index: number): DerivedAddress {
    const derivedPk = this._change.derive(index).publicKey;
    return { index, script: Address.fromPk(derivedPk.toString("hex")).address };
  }

  public deriveAddresses(count: number, offset = 0): DerivedAddress[] {
    const addresses: DerivedAddress[] = [];
    for (let i = offset; i < count + offset; i++) {
      addresses.push(this.deriveAddress(i));
    }

    return addresses;
  }
}
