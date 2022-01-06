import { AddressState, AddressType, AssetType, Network, WalletType } from "@/types/internal";

export type IDbWallet = {
  id?: number;
  name: string;
  network: Network;
  type: WalletType;
  publicKey: string;
  privateKey?: string;
  chainCode: string;
  seed?: string;
};

export type IDbAddress = {
  type: AddressType;
  state: AddressState;
  script: string;
  index: number;
  walletId: number;
};

export type IDbAsset = {
  tokenId: string;
  name: string;
  type: AssetType;
  confirmedAmount: string;
  unconfirmedAmount?: string;
  decimals: number;
  address: string;
  walletId: number;
};
