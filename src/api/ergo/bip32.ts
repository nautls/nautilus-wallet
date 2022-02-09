import BIP32Factory, { BIP32Interface } from "bip32";
import * as ecc from "tiny-secp256k1";
import { DERIVATION_PATH } from "@/constants/ergo";
import bs58check from "bs58check";
import * as bip39 from "bip39";
import { addressFromPk } from "./addresses";

const bip32 = BIP32Factory(ecc);

export type DerivedAddress = {
  index: number;
  script: string;
};

export default class Bip32 {
  private _change!: BIP32Interface;
  private _extendedPk!: Buffer;

  private constructor(bip32: BIP32Interface, derivationPath?: string) {
    if (bip32.isNeutered()) {
      if (derivationPath) {
        this._change = bip32.derivePath(derivationPath);
      } else {
        this._change = bip32;
      }
    } else {
      this._change = bip32.derivePath(DERIVATION_PATH);
    }
  }

  public neutered(): Bip32 {
    if (this._change.isNeutered()) {
      return this;
    }

    this._change = this._change.neutered();
    return this;
  }

  public static async fromMnemonic(mnemonic: string): Promise<Bip32> {
    return new this(bip32.fromSeed(await bip39.mnemonicToSeed(mnemonic)));
  }

  public static fromPublicKey(
    publicKey: string | { publicKey: string; chainCode: string },
    derivationPath?: string
  ): Bip32 {
    if (typeof publicKey === "string") {
      const buffer = Buffer.from(publicKey, "hex");
      return new this(bip32.fromPublicKey(buffer.slice(45, 78), buffer.slice(13, 45)));
    } else {
      return new this(
        bip32.fromPublicKey(
          Buffer.from(publicKey.publicKey, "hex"),
          Buffer.from(publicKey.chainCode, "hex")
        ),
        derivationPath
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
      this._extendedPk = this.normalizeExtendedKey(
        bs58check.decode(this._change.neutered().toBase58())
      );
    }

    return this._extendedPk;
  }

  private normalizeExtendedKey(key: Buffer) {
    return key.fill(0, 4, 12);
  }

  public derivePrivateKey(index: number): Buffer {
    const pk = this._change.derive(index).privateKey;
    if (!pk) {
      throw Error("private key not found.");
    }

    return pk;
  }

  public deriveAddress(index: number): DerivedAddress {
    const derivedPk = this._change.derive(index).publicKey;
    return { index, script: addressFromPk(derivedPk.toString("hex")) };
  }

  public deriveAddresses(count: number, offset = 0): DerivedAddress[] {
    const addresses: DerivedAddress[] = [];
    for (let i = offset; i < count + offset; i++) {
      addresses.push(this.deriveAddress(i));
    }

    return addresses;
  }
}
