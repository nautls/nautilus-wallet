import {
  AddressState,
  AddressType,
  AssetStandard,
  AssetType,
  Network,
  WalletSettings,
  WalletType
} from "@/types/internal";
import { Registers, ErgoBox } from "./connector";

export interface IDbWallet {
  id?: number;
  name: string;
  network: Network;
  type: WalletType;
  publicKey: string;
  chainCode: string;
  mnemonic?: string;
  settings: WalletSettings;
}

export interface IDbAddress {
  type: AddressType;
  state: AddressState;
  script: string;
  index: number;
  walletId: number;
}

export interface IDbAsset {
  tokenId: string;
  name: string;
  type: AssetStandard;
  confirmedAmount: string;
  unconfirmedAmount?: string;
  decimals: number;
  address: string;
  walletId: number;
}

export interface IDbDAppConnection {
  origin: string;
  walletId: number;
  favicon?: string;
}

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

export interface IDbUtxo {
  id: string;
  confirmed: boolean;
  locked: boolean;
  spentTxId: string;
  spentTimestamp?: number;
  content?: ErgoBox;
  address?: string;
  walletId: number;
}
