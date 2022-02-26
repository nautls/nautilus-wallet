import {
  AddressState,
  AddressType,
  AssetType,
  Network,
  WalletSettings,
  WalletType
} from "@/types/internal";
import { ErgoBox } from "./connector";

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
  type: AssetType;
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

export interface IDbPendingBox {
  boxId: string;
  transactionId: string;
  confirmed: boolean;
  locked: boolean;
  content?: ErgoBox;
  address?: string;
  walletId: number;
}
