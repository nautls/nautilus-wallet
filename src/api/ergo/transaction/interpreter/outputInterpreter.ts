import { ERG_DECIMALS, ERG_TOKEN_ID, MAINNET } from "@/constants/ergo";
import { ErgoBoxCandidate } from "@/types/connector";
import { decimalize, toBigNumber } from "@/utils/bigNumbers";
import BigNumber from "bignumber.js";
import { find, findIndex, first, isEmpty } from "lodash-es";
import { sigmaDecode } from "@/api/ergo/serialization";
import { StateAssetInfo } from "@/types/internal";
import { isBabelContract } from "../../babelFees";
import { AddressType, ErgoAddress, Network } from "@fleet-sdk/core";
import { EIP12UnsignedInput } from "@fleet-sdk/common";
import { utf8 } from "@fleet-sdk/crypto";

export type OutputAsset = {
  tokenId: string;
  name?: string;
  amount: BigNumber;
  decimals?: number;
  description?: string;
  minting?: boolean;
};

const network = MAINNET ? Network.Mainnet : Network.Testnet;

export class OutputInterpreter {
  private readonly _box!: ErgoBoxCandidate;
  private readonly _inputs!: EIP12UnsignedInput[];
  private readonly _assets!: OutputAsset[];
  private readonly _assetInfo!: StateAssetInfo;
  private readonly _addresses?: string[];

  private readonly _receiver: ErgoAddress;

  public get receiver(): string {
    return this._receiver.encode(network);
  }

  public get scriptHash(): string {
    return this._receiver.toP2SH(network);
  }

  public get receiverAddressType(): AddressType {
    return this._receiver.type;
  }

  public get assets(): OutputAsset[] {
    return this._assets;
  }

  public get isIntrawallet(): boolean {
    return this._addresses?.includes(this.receiver) ?? false;
  }

  public get isMinting(): boolean {
    return find(this._assets, (a) => a.minting) !== undefined;
  }

  public get isBabelBoxSwap(): boolean {
    return (
      isBabelContract(this._box.ergoTree) &&
      this._inputs.find((input) => input.ergoTree === this._box.ergoTree) !== undefined
    );
  }

  constructor(
    boxCandidate: ErgoBoxCandidate,
    inputs: EIP12UnsignedInput[],
    assetInfo: StateAssetInfo,
    addresses?: string[]
  ) {
    this._box = boxCandidate;
    this._receiver = ErgoAddress.fromErgoTree(boxCandidate.ergoTree);
    this._inputs = inputs;
    this._assetInfo = assetInfo;
    this._addresses = addresses;
    this._assets = this.isBabelBoxSwap
      ? this.buildBabelSwapAssetsList()
      : this.buildSendingAssetsList();
  }

  private buildBabelSwapAssetsList(): OutputAsset[] {
    const input = this._inputs.find((input) => input.ergoTree === this._box.ergoTree);
    if (!input) {
      return this.buildSendingAssetsList();
    }

    const assets = this._box.assets.map((token) => {
      const inputValue = input.assets.find((asset) => asset.tokenId === token.tokenId)?.amount || 0;

      return {
        tokenId: token.tokenId,
        name: this._assetInfo[token.tokenId]?.name,
        amount: decimalize(
          toBigNumber(token.amount).minus(inputValue),
          this._assetInfo[token.tokenId].decimals || 0
        )
      } as OutputAsset;
    });

    assets.push({
      tokenId: ERG_TOKEN_ID,
      name: "ERG",
      amount: decimalize(toBigNumber(input.value).minus(this._box.value), ERG_DECIMALS)
    });

    return assets;
  }

  private buildSendingAssetsList(): OutputAsset[] {
    const assets = [] as OutputAsset[];
    assets.push({
      tokenId: ERG_TOKEN_ID,
      name: "ERG",
      amount: decimalize(toBigNumber(this._box.value), ERG_DECIMALS)
    });

    if (isEmpty(this._box.assets)) {
      return assets;
    }

    const tokens = this._box.assets.map((t) => {
      return {
        tokenId: t.tokenId,
        name: this._assetInfo[t.tokenId]?.name,
        amount: this._assetInfo[t.tokenId]?.decimals
          ? decimalize(toBigNumber(t.amount), this._assetInfo[t.tokenId].decimals || 0)
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
        amount: toBigNumber(token.amount)
      };
    }

    const decodedDecimals = sigmaDecode(this._box.additionalRegisters["R6"], utf8);
    const decimals = decodedDecimals ? parseInt(decodedDecimals) : undefined;
    return {
      tokenId: token.tokenId,
      name: sigmaDecode(this._box.additionalRegisters["R4"], utf8) ?? "",
      decimals,
      amount: decimals
        ? decimalize(toBigNumber(token.amount), decimals)
        : toBigNumber(token.amount),
      description: sigmaDecode(this._box.additionalRegisters["R5"], utf8) ?? "",
      minting: true
    };
  }
}
