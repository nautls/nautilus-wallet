import BigNumber from "bignumber.js";

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

export type Wallet = {
  id?: number;
  name: string;
  network: Network;
  type: WalletType;
  category?: AssetCategory;
  publicKey: string;
  privateKey?: string;
  chainCode: string;
  addresses: Address[];
};

export type Address = {
  id?: number;
  type: AddressType;
  script: string;
  balance: BigNumber;
  assets?: Asset[];
};

export type Asset = {
  id?: number;
  type: AssetType;
  tokenId: string;
  amount: BigNumber;
  decimals: number;
  name: string;
};
