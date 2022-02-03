import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";
import { ErgoBoxCandidate, Token, UnsignedInput } from "@/types/connector";
import { setDecimals, toBigNumber } from "@/utils/bigNumbers";
import { Address } from "@coinbarn/ergo-ts";
import BigNumber from "bignumber.js";
import { find, findIndex, first, isEmpty, min } from "lodash";
import { AssetInfo } from "./txInterpreter";

export type OutputAsset = {
  tokenId: string;
  name?: string;
  amount: BigNumber;
  decimals?: number;
  description?: string;
  isMinting?: boolean;
};

export class OutputInterpreter {
  private _box!: ErgoBoxCandidate;
  private _inputs!: UnsignedInput[];
  private _assets!: OutputAsset[];
  private _assetInfo!: AssetInfo;

  public get receiver(): String {
    return Address.fromErgoTree(this._box.ergoTree).address;
  }

  public get assets(): OutputAsset[] {
    return this._assets;
  }

  constructor(boxCandidate: ErgoBoxCandidate, inputs: UnsignedInput[], assetInfo: AssetInfo) {
    this._box = boxCandidate;
    this._inputs = inputs;
    this._assetInfo = assetInfo;
    this._assets = this.getSendingAssets();
  }

  getSendingAssets(): OutputAsset[] {
    const assets = [] as OutputAsset[];
    assets.push({
      tokenId: ERG_TOKEN_ID,
      name: "ERG",
      amount: setDecimals(toBigNumber(this._box.value)!, ERG_DECIMALS)
    });

    if (isEmpty(this._box.assets)) {
      return assets;
    }

    const tokens = this._box.assets.map((t) => {
      return {
        tokenId: t.tokenId,
        name: this._assetInfo[t.tokenId]?.name,
        amount: this._assetInfo[t.tokenId]?.decimals
          ? setDecimals(toBigNumber(t.amount)!, this._assetInfo[t.tokenId].decimals)
          : toBigNumber(t.amount)
      } as OutputAsset;
    });

    const minting = this.getMintingToken();
    if (minting) {
      const index = findIndex(tokens, (t) => t.tokenId === minting.tokenId);
      if (index > -1) {
        tokens[index] = minting;
      }
    }

    return assets.concat(tokens);
  }

  private getMintingToken(): OutputAsset | undefined {
    const firstInputId = first(this._inputs)?.boxId;
    if (!firstInputId) {
      return undefined;
    }

    const token = find(this._box.assets, (b) => b.tokenId === firstInputId);
    if (!token) {
      return undefined;
    }

    if (isEmpty(this._box.additionalRegisters)) {
      return {
        tokenId: token.tokenId,
        amount: toBigNumber(token.amount)!
      };
    }

    const decimals = parseInt(this.parseRegister(this._box.additionalRegisters["R6"]) ?? "");
    return {
      tokenId: token.tokenId,
      name: this.parseRegister(this._box.additionalRegisters["R4"]) ?? "",
      decimals,
      amount: decimals
        ? setDecimals(toBigNumber(token.amount)!, decimals)
        : toBigNumber(token.amount)!,
      description: this.parseRegister(this._box.additionalRegisters["R5"]) ?? "",
      isMinting: true
    };
  }

  private parseRegister(input: any): string | undefined {
    if (typeof input !== "string" || !input.startsWith("0e") || input.length < 4) {
      return;
    }

    let body = input.slice(2);
    let len = 0;
    let readNext = true;
    do {
      const lenChunk = parseInt(body.slice(0, 2), 16);
      body = body.slice(2);
      if (isNaN(lenChunk)) {
        return;
      }
      readNext = (lenChunk & 0x80) !== 0;
      len = 128 * len + (lenChunk & 0x7f);
    } while (readNext);

    if (2 * len < body.length) {
      return;
    }

    return Buffer.from(body.slice(0, 2 * len), "hex").toString("utf8");
  }
}
