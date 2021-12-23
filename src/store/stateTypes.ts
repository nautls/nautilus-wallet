import { ExplorerV1AddressBalanceResponse } from "@/types/explorer";
import { AddressState, AddressType, WalletType } from "@/types/internal";
import BigNumber from "bignumber.js";

export type StateAddress = {
  address: string;
  state: AddressState;
  index: number;
  balance?: ExplorerV1AddressBalanceResponse;
};

export type StateWallet = {
  id: number;
  name: string;
  type: WalletType;
  publicKey: string;
  extendedPublicKey: string;
  balance: BigNumber;
  addresses?: AddressType[];
};

export type StateAsset = {
  tokenId: string;
  amount: BigNumber;
  decimals: number;
  name: string;
  price?: number;
};
