import {
  AddressState,
  AddressType,
  AssetStandard,
  AssetSubtype,
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
  confirmedAmount: string;
  unconfirmedAmount?: string;
  address: string;
  walletId: number;
}

export interface IDbDAppConnection {
  origin: string;
  walletId: number;
  favicon?: string;
}

export interface IAssetInfo {
  id: string;
  mintingBoxId: string;
  mintingTransactionId?: string;
  name?: string;
  decimals?: number;
  standard?: AssetStandard;
  type: AssetType;
  subtype?: AssetSubtype;
  emissionAmount?: string;
  description?: string;
  artworkUrl?: string;
  artworkCover?: string;
  artworkHash?: string;
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
