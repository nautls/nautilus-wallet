import { ExplorerBlockHeaderResponse } from "@/types/explorer";
import Bip32 from "../bip32";

export class SignContext {
  private _bip32!: Bip32;
  private _headers!: ExplorerBlockHeaderResponse[];

  private constructor(blockHeaders: ExplorerBlockHeaderResponse[]) {
    this._headers = blockHeaders;
  }

  public static fromBlockHeaders(blockHeaders: ExplorerBlockHeaderResponse[]): SignContext {
    return new this(blockHeaders);
  }

  public withBip32(bip32: Bip32): SignContext {
    this._bip32 = bip32;
    return this;
  }

  public get bip32(): Bip32 {
    return this._bip32;
  }

  public get blockHeaders(): ExplorerBlockHeaderResponse[] {
    return this._headers;
  }
}
