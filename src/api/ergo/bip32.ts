import { fromPublicKey, fromSeed, BIP32Interface } from "bip32";
import * as consts from "@/utils/constants";
import bs58check from "bs58check";
import { Address } from "@coinbarn/ergo-ts";

export type DerivedAddress = {
  index: number;
  address: string;
};

export default class Bip32 {
  private _change!: BIP32Interface;
  private _extendedPk!: Buffer;

  private constructor(bip32: BIP32Interface) {
    if (bip32.isNeutered()) {
      this._change = bip32;
    } else {
      this._change = bip32.derivePath(consts.derivationPath);
      this._change.index = 0;
      this._change.parentFingerprint = 0;
    }
  }

  public static fromSeed(seed: Buffer): Bip32 {
    return new this(fromSeed(seed));
  }

  public static fromPublicKey(publicKey: string | { publicKey: string; chainCode: string }): Bip32 {
    if (typeof publicKey === "string") {
      const buffer = Buffer.from(publicKey, "hex");
      return new this(fromPublicKey(buffer.slice(45, 78), buffer.slice(13, 45)));
    } else {
      return new this(
        fromPublicKey(
          Buffer.from(publicKey.publicKey, "hex"),
          Buffer.from(publicKey.chainCode, "hex")
        )
      );
    }
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
      this._extendedPk = bs58check.decode(this._change.neutered().toBase58());
    }

    return this._extendedPk;
  }

  public deriveAddress(index: number): string {
    const derivedPk = this._change.derive(index).publicKey;
    return Address.fromPk(derivedPk.toString("hex")).address;
  }

  public deriveAddresses(count: number, offset = 0): DerivedAddress[] {
    const addresses: DerivedAddress[] = [];
    for (let i = offset; i < count + offset; i++) {
      addresses.push({ index: i, address: this.deriveAddress(i) });
    }

    return addresses;
  }
}
