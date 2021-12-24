import { AddressState, AddressType, AssetType, Network, WalletType } from "@/types/internal";

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
  type: AddressType;
  state: AddressState;
  script: string;
  index: number;
  walletId: number;
};

export type IDbAsset = {
  type: AssetType;
  tokenId: string;
  amount: string;
  decimals: number;
  name: string;
  address: string;
};
