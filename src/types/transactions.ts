import { ChainProviderUnconfirmedTransaction } from "@fleet-sdk/blockchain-providers";
import { BigNumber } from "bignumber.js";
import { Box, BoxSummary } from "@fleet-sdk/common";

export type TransactionSummary = {
  transactionId: string;
  timestamp: number;
  fee: BigNumber;
  delta: BoxSummary;
};

export type ConfirmedTransactionSummary = TransactionSummary & {
  confirmed: true;
  height: number;
};

export type UnconfirmedTransactionSummary = TransactionSummary & {
  confirmed: false;
  cancelable: boolean;
  ownInputs: Box<string>[];
};
