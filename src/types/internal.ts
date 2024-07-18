import { BigNumber } from "bignumber.js";
import { EIP12UnsignedTransaction, TokenId } from "@fleet-sdk/common";
import { ErgoBox } from "./connector";
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

export type StateAddress = {
  script: string;
  state: AddressState;
  index: number;
  balance: StateAsset[];
};

export type WalletSettings = {
  avoidAddressReuse: boolean;
  hideUsedAddresses: boolean;
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

export type StateAsset = {
  tokenId: string;
  confirmedAmount: BigNumberType;
  unconfirmedAmount?: BigNumberType;
  metadata?: BasicAssetMetadata;
};

export type BasicAssetMetadata = {
  name?: string;
  decimals?: number;
  type?: AssetSubtype;
  artworkUrl?: string;
};

export type AssetsMetadataMap = Map<TokenId, BasicAssetMetadata>;

export type BigNumberType = Omit<BigNumber, "_isBigNumber">;

export type FeeSettings = {
  tokenId: string;
  readonly value: BigNumberType;
  readonly nanoErgsPerToken?: BigNumberType;
  readonly assetInfo?: BasicAssetMetadata;
  box?: ErgoBox;
};

export type UpdateWalletSettingsCommand = {
  walletId: number;
  name: string;
  avoidAddressReuse: boolean;
  hideUsedAddresses: boolean;
  devMode: boolean;
};

export type UpdateChangeIndexCommand = {
  walletId: number;
  index: number;
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

// eslint-disable-next-line @typescript-eslint/ban-types
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type UpdateUsedAddressesFilterCommand = {
  walletId: number;
  filter: boolean;
};
