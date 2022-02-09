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
  ErgoMainet,
  ErgoTestnet
}

export enum AddressType {
  P2PK,
  P2SH,
  P2S
}

export enum AssetType {
  Native = "Native",
  EIP4 = "EIP-004"
}

export enum AssetCategory {
  PictureNFT = "0101",
  AudioNFT = "0102",
  VideoNFT = "0103",
  MembershipThresholdSignToken = "0201"
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
  name: string;
  confirmedAmount: BigNumber;
  unconfirmedAmount?: BigNumber;
  decimals: number;
  price?: number;
};

export type SendTxCommandAsset = {
  asset: StateAsset;
  amount?: BigNumber;
};

export type SendTxCommand = {
  walletId: number;
  assets: SendTxCommandAsset[];
  fee: BigNumber;
  recipient: string;
  password: string;
};

export type SignTxFromConnectorCommand = {
  tx: UnsignedTx;
  walletId: number;
  password: string;
};

export type UpdateWalletSettingsCommand = {
  walletId: number;
  name: string;
  avoidAddressReuse: boolean;
  hideUsedAddresses: boolean;
};

export type UpdateChangeIndexCommand = {
  walletId: number;
  index: number;
};
