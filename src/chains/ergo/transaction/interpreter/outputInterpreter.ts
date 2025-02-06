import { isValidBabelContract } from "@fleet-sdk/babel-fees-plugin";
import { AddressType, EIP12UnsignedInput, first, isEmpty } from "@fleet-sdk/common";
import { ErgoAddress, Network } from "@fleet-sdk/core";
import { utf8 } from "@fleet-sdk/crypto";
import { decode } from "@fleet-sdk/serializer";
import { BigNumber } from "bignumber.js";
import { bn, decimalize } from "@/common/bigNumber";
import { ERG_DECIMALS, ERG_TOKEN_ID, MAINNET } from "@/constants/ergo";
import { ErgoBoxCandidate } from "@/types/connector";
import { AssetsMetadataMap, BasicAssetMetadata } from "@/types/internal";

export type OutputAsset = {
  tokenId: string;
  amount: BigNumber;
  metadata?: BasicAssetMetadata;
  minting?: boolean;
};

const network = MAINNET ? Network.Mainnet : Network.Testnet;

export class OutputInterpreter {
  private readonly _box!: ErgoBoxCandidate;
  private readonly _inputs!: EIP12UnsignedInput[];
  private readonly _assets!: OutputAsset[];
  private readonly _metadata!: AssetsMetadataMap;
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

  public get isReceiving(): boolean {
    return this._addresses?.includes(this.receiver) ?? false;
  }

  public get isMinting(): boolean {
    return this._assets.find((a) => a.minting) !== undefined;
  }

  public get isBabelSwap(): boolean {
    return (
      isValidBabelContract(this._box.ergoTree) &&
      this._inputs.find((input) => input.ergoTree === this._box.ergoTree) !== undefined
    );
  }

  constructor(
    boxCandidate: ErgoBoxCandidate,
    inputs: EIP12UnsignedInput[],
    metadata: AssetsMetadataMap,
    addresses?: string[]
  ) {
    this._box = boxCandidate;
    this._receiver = ErgoAddress.fromErgoTree(boxCandidate.ergoTree);
    this._inputs = inputs;
    this._metadata = metadata;
    this._addresses = addresses;
    this._assets = this.isBabelSwap
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
      const metadata = this._metadata.get(token.tokenId);

      return {
        tokenId: token.tokenId,
        amount: decimalize(bn(token.amount).minus(inputValue), metadata?.decimals || 0),
        metadata
      } as OutputAsset;
    });

    assets.push({
      tokenId: ERG_TOKEN_ID,
      amount: decimalize(bn(input.value).minus(this._box.value), ERG_DECIMALS),
      metadata: this._metadata.get(ERG_TOKEN_ID)
    });

    return assets;
  }

  private buildSendingAssetsList(): OutputAsset[] {
    const assets = [] as OutputAsset[];
    assets.push({
      tokenId: ERG_TOKEN_ID,
      amount: decimalize(bn(this._box.value), ERG_DECIMALS),
      metadata: this._metadata.get(ERG_TOKEN_ID)
    });

    if (isEmpty(this._box.assets)) return assets;

    const tokens = this._box.assets.map((t): OutputAsset => {
      const metadata = this._metadata.get(t.tokenId);
      return {
        tokenId: t.tokenId,
        amount: decimalize(bn(t.amount), metadata?.decimals || 0),
        metadata
      };
    });

    const minting = this.getMintingToken();
    if (minting) {
      const index = tokens.findIndex((t) => t.tokenId === minting.tokenId);
      if (index > -1) {
        tokens[index] = minting;
      }
    }

    return assets.concat(tokens);
  }

  private getMintingToken(): OutputAsset | undefined {
    const firstInputId = first(this._inputs)?.boxId;
    if (!firstInputId) return undefined;

    const token = this._box.assets.find((b) => b.tokenId === firstInputId);
    if (!token) return undefined;

    if (isEmpty(this._box.additionalRegisters)) {
      return { tokenId: token.tokenId, amount: bn(token.amount) };
    }

    const decimals = decodeDecimals(this._box.additionalRegisters["R6"]);
    return {
      tokenId: token.tokenId,
      amount: decimals ? decimalize(bn(token.amount), decimals) : bn(token.amount),
      metadata: {
        name: decodeUtf8(this._box.additionalRegisters["R4"]) ?? "",
        decimals,
        description: decodeUtf8(this._box.additionalRegisters["R5"]) ?? ""
      },
      minting: true
    };
  }
}

function decodeUtf8(value: string): string | undefined {
  const r = decode(value);
  if (!r || r.type.toString() !== "SColl[SByte]") return;

  return utf8.encode(r.data as Uint8Array);
}

function decodeDecimals(value: string): number | undefined {
  const r6 = decode(value);
  if (!r6) return;

  if (r6.type.toString() === "SColl[SByte]") {
    return Number.parseInt(utf8.encode(r6.data as Uint8Array), 10);
  }

  return typeof r6.data === "number" ? r6.data : Number(r6.data);
}
