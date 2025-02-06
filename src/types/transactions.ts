import { Box, BoxSummary } from "@fleet-sdk/common";
import { BigNumber } from "bignumber.js";

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
