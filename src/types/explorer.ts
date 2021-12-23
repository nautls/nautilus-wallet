import BigNumber from "bignumber.js";

export type AddressAPIResponse<T> = {
  address: string;
  data: T;
};

type ExplorerInputBox = {
  id: string;
  value: number | BigNumber;
  index: number;
  spendingProof: string;
  transactionId: string;
  outputTransactionId: string;
  outputIndex: number;
  address: string;
};

type ExplorerDataInputBox = {
  id: string;
  value: number;
  index: number;
  transactionId: string;
  outputTransactionId: string;
  outputIndex: number;
  address: string;
};

type ExplorerToken = {
  tokenId: string;
  index: number;
  amount: number | BigNumber;
  name: string;
  decimals: number;
  type: string;
};

type ExplorerOutputBox = {
  id: string;
  txId: string;
  value: number | BigNumber;
  index: number;
  creationHeight: number;
  ergoTree: string;
  address: string;
  assets: ExplorerToken[];
  additionalRegisters: {
    property1: string;
    property2: string;
  };
  spentTransactionId: string;
  mainChain: boolean;
};

/**
 * getApiV0AddressesP1Transactions response type
 */
export type ExplorerV0TransactionsPerAddressResponse = {
  items: [
    {
      id: string;
      headerId: string;
      inclusionHeight: number;
      timestamp: number;
      index: number;
      confirmationsCount: number;
      inputs: ExplorerInputBox[];
      dataInputs: ExplorerDataInputBox[];
      outputs: ExplorerOutputBox[];
    }
  ];
  total: number;
};

type ExplorerBalanceItem = {
  nanoErgs: number;
  tokens: [
    {
      tokenId: string;
      amount: number | BigNumber;
      decimals: number;
      name: string;
    }
  ];
};

/**
 * response for getApiV1AddressesP1BalanceTotal
 */
export type ExplorerV1AddressBalanceResponse = {
  confirmed: ExplorerBalanceItem;
  unconfirmed: ExplorerBalanceItem;
};
