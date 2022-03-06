import {
  AddressState,
  AddressType,
  AssetStandard,
  AssetType,
  Network,
  WalletSettings,
  WalletType
} from "@/types/internal";
import { Registers } from "./connector";

export type IDbWallet = {
  id?: number;
  name: string;
  network: Network;
  type: WalletType;
  publicKey: string;
  chainCode: string;
  mnemonic?: string;
  settings: WalletSettings;
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
  type: AssetStandard;
  confirmedAmount: string;
  unconfirmedAmount?: string;
  decimals: number;
  address: string;
  walletId: number;
};

export type IDbDAppConnection = {
  origin: string;
  walletId: number;
  favicon?: string;
};

export interface IDbAssetInfo {
  id: string;
  standard: AssetStandard;
  decimals?: string;
  type?: AssetType;
  name?: string;
  mintingBoxId?: string;
  transactionId?: string;
  emissionAmount?: string;
  description?: string;
  additionalRegisters?: Registers;
}
