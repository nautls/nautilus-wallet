import { AddressState, AddressType, WalletType } from "@/types";
import BigNumber from "bignumber.js";

export type StateAddress = {
  address: string;
  state: AddressState;
  index: number;
  balance: any;
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
