import { LedgerDeviceModelId } from "@/constants/ledger";
import BigNumber from "bignumber.js";
import { UnsignedTx } from "./connector";

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
  balance?: StateAsset[];
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
  confirmedAmount: BigNumber;
  unconfirmedAmount?: BigNumber;
  info?: BasicAssetInfo;
};

export type BasicAssetInfo = {
  name?: string;
  decimals?: number;
  type?: AssetSubtype;
  artworkUrl?: string;
};

export type StateAssetInfo = {
  [tokenId: string]: BasicAssetInfo;
};

export type SignTxCommand = {
  tx: UnsignedTx;
  walletId: number;
  password: string;
  callback?: (newState: Partial<SigningState>) => void;
};

export type SignEip28MessageCommand = {
  message: string;
  address: string;
  origin: string;
  walletId: number;
  password: string;
};

export type Eip28SignedMessage = {
  signedMessage: string;
  proof: string;
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

export type SigningState = {
  loading: boolean;
  connected: boolean;
  statusText: string;
  screenText: string;
  deviceModel: LedgerDeviceModelId;
  state: string;
  appId: number;
};

export type UpdateUsedAddressesFilterCommand = {
  walletId: number;
  filter: boolean;
};
