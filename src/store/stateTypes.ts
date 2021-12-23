import { AddressState, AddressType, WalletType } from "@/types/internal";
import BigNumber from "bignumber.js";

export type StateAddress = {
  script: string;
  state: AddressState;
  index: number;
  balance?: StateAsset[];
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
  name: string;
  confirmedAmount: BigNumber;
  unconfirmedAmount?: BigNumber;
  price?: number;
};
