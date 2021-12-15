import * as bip39 from "bip39";
import * as consts from "@/utils/constantsts";
import Bip32 from "./bip32";

export default class Mnemonic {
  private _mnemonic = "";

  constructor();
  constructor(strength: number);
  constructor(mnemonic: string);
  constructor(value?: number | string) {
    if (typeof value == "string") {
      if (!bip39.validateMnemonic(value)) {
        throw "Invalid mnemonic";
      }

      this._mnemonic = value;
      return;
    }

    this._mnemonic = this.newMnemonic(value || consts.defaultStrength);
  }

  private newMnemonic(strength: number): string {
    return bip39.generateMnemonic(strength);
  }

  public async toBip32(): Promise<Bip32> {
    return bip39
      .mnemonicToSeed(this._mnemonic)
      .then(buffer => {
        return Bip32.fromSeed(buffer);
      })
      .catch(reason => {
        return Promise.reject(reason);
      });
  }

  public toString(): string {
    return this._mnemonic;
  }
}
