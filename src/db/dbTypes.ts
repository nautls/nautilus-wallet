import { AddressState, AddressType, AssetType, Network, WalletType } from "@/types";

export type IDbWallet = {
  id?: number;
  name: string;
  network: Network;
  type: WalletType;
  publicKey: string;
  privateKey?: string;
  chainCode: string;
};

export type IDbAddress = {
  id?: number;
  type: AddressType;
  state: AddressState;
  script: string;
  balance: string;
  walletId: number;
};

export type IDbAsset = {
  id?: number;
  type: AssetType;
  tokenId: string;
  amount: string;
  decimals: number;
  name: string;
  addressId: number;
};
