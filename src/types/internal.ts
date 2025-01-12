import { BabelBox } from "@fleet-sdk/babel-fees-plugin";
import { EIP12UnsignedTransaction, TokenId } from "@fleet-sdk/common";
import { BigNumber } from "bignumber.js";
import { LedgerDeviceModelId } from "@/constants/ledger";

export enum AddressState {
  Used,
  Unused
}

export enum WalletType {
  Standard,
  ReadOnly,
  Ledger
}

export enum Network {
  ErgoMainnet,
  ErgoTestnet
}

export enum AddressType {
  P2PK,
  P2SH,
  P2S
}

export enum AssetStandard {
  Native = "Native",
  EIP4 = "EIP-004",
  Unstandardized = "Unstandardized"
}

export enum AssetType {
  Unknown = "00",
  NFT = "01",
  MembershipToken = "02"
}

export enum AssetSubtype {
  PictureArtwork = "0101",
  AudioArtwork = "0102",
  VideoArtwork = "0103",
  ThresholdSignature = "0201"
}

export type AddressFilter = "all" | "active" | "unused";

export type WalletSettings = {
  avoidAddressReuse: boolean;
  addressFilter: AddressFilter;
  defaultChangeIndex: number;
};

export type StateWallet = {
  id: number;
  name: string;
  type: WalletType;
  publicKey: string;
  extendedPublicKey: string;
  addresses?: AddressType[];
  settings: WalletSettings;
};

export type BasicAssetMetadata = {
  name?: string;
  decimals?: number;
  type?: AssetSubtype;
  artworkUrl?: string;
};

export interface AssetInfo {
  tokenId: string;
  metadata?: BasicAssetMetadata;
}

export type AssetsMetadataMap = Map<TokenId, BasicAssetMetadata>;

export type FeeSettings = {
  tokenId: string;
  readonly value: BigNumber;
  readonly nanoErgsPerToken?: BigNumber;
  readonly assetInfo?: BasicAssetMetadata;
  box?: BabelBox;
};

export const enum ProverStateType {
  success,
  error,
  busy,
  unavailable
}

export type ProverDeviceState = {
  model: LedgerDeviceModelId;
  appId: number;
  connected: boolean;
  screenText?: string;
};

export type SigningState = {
  statusText: string;
  type?: ProverStateType;
  device?: ProverDeviceState;
};

export type TransactionBuilderFunction = () => Promise<EIP12UnsignedTransaction>;
