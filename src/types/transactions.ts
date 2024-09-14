import { ChainProviderUnconfirmedTransaction } from "@fleet-sdk/blockchain-providers";
import { BigNumber } from "bignumber.js";
import { TokenAmount } from "@fleet-sdk/common";
import { BasicAssetMetadata } from "./internal";

export type TransactionSummary = {
  transactionId: string;
  timestamp: number;
  fee: BigNumber;
  delta: (TokenAmount<BigNumber> & { metadata?: BasicAssetMetadata })[];
};

export type ConfirmedTransactionSummary = TransactionSummary & {
  confirmed: true;
  height: number;
};

export type UnconfirmedTransactionSummary = TransactionSummary & {
  confirmed: false;
  transaction: ChainProviderUnconfirmedTransaction<string>;
};
