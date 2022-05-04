import BigNumber from "bignumber.js";
import { ErgoBox, Token } from "./connector";
import { AssetStandard } from "./internal";

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

export type ExplorerToken = {
  tokenId: string;
  index: number;
  amount: number | string | BigNumber;
  name: string;
  decimals: number;
  type: string;
};

export type ExplorerOutputBox = {
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

export type AssetBalance = {
  tokenId: string;
  name?: string;
  decimals?: number;
  standard?: AssetStandard;
  confirmedAmount: string;
  unconfirmedAmount?: string;
  address: string;
};

type ExplorerBalanceItem = {
  nanoErgs: number | BigNumber;
  tokens: [
    {
      tokenId: string;
      amount: number | BigNumber;
      decimals: number;
      name: string;
      tokenType?: string;
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

export type ExplorerBlockHeaderResponse = {
  id: string;
  parentId: string;
  version: number;
  height: number;
  epoch: number;
  difficulty: string;
  adProofsRoot: string;
  stateRoot: string;
  transactionsRoot: string;
  timestamp: number;
  nBits: number;
  size: number;
  extensionHash: string;
  powSolutions: {
    pk: string;
    w: string;
    n: string;
    d: string;
  };
  votes: {
    _1: number;
    _2: number;
    _3: number;
  };
};

export type ExplorerGetApiV1BlocksP1Response = {
  block: {
    header: ExplorerBlockHeaderResponse;
    blockTransactions: [
      {
        id: string;
        headerId: string;
        inclusionHeight: number;
        timestamp: number;
        index: number;
        confirmationsCount: number;
        inputs: [
          {
            id: string;
            value: number;
            index: number;
            spendingProof: string;
            transactionId: string;
            outputTransactionId: string;
            outputIndex: number;
            address: string;
          }
        ];
        dataInputs: [
          {
            id: string;
            value: number;
            index: number;
            transactionId: string;
            outputTransactionId: string;
            outputIndex: number;
            address: string;
          }
        ];
        outputs: [
          {
            id: string;
            txId: string;
            value: number;
            index: number;
            creationHeight: number;
            ergoTree: string;
            address: string;
            assets: [
              {
                tokenId: string;
                index: number;
                amount: number;
                name: string;
                decimals: number;
                type: string;
              }
            ];
            additionalRegisters: {
              property1: string;
              property2: string;
            };
            spentTransactionId: string;
            mainChain: boolean;
          }
        ];
      }
    ];
    extension: {
      headerId: string;
      digest: string;
      fields: {
        property1: string;
        property2: string;
      };
    };
    adProofs: string;
  };
  references: {
    previousId: string;
    nextId: string;
  };
};

export type ExplorerPostApiV1MempoolTransactionsSubmitResponse = {
  id: string;
};

export type ExplorerBox = {
  id: string;
  txId: string;
  value: number | string | BigNumber;
  index: number;
  creationHeight: number;
  ergoTree: string;
  address: string;
  assets: ExplorerToken[];
  additionalRegisters: any;
  spentTransactionId?: string;
  mainChain: boolean;
};

export function explorerBoxMapper(options: { asConfirmed: boolean }) {
  return (box: ExplorerBox) => {
    return {
      boxId: box.id,
      transactionId: box.txId,
      index: box.index,
      ergoTree: box.ergoTree,
      creationHeight: box.creationHeight,
      value: box.value.toString(),
      assets: box.assets.map((t) => {
        return {
          tokenId: t.tokenId,
          amount: t.amount.toString()
        } as Token;
      }),
      additionalRegisters: box.additionalRegisters,
      confirmed: options.asConfirmed
    } as ErgoBox;
  };
}

export type ErgoDexPool = {
  id: string;
  baseId: string;
  baseSymbol: string;
  quoteId: string;
  quoteSymbol: string;
  lastPrice: number;
  baseVolume: ErgoDexPoolVolume;
  quoteVolume: ErgoDexPoolVolume;
};

export type ErgoDexPoolVolume = {
  value: number;
};

export type AssetPriceRate = {
  [tokenId: string]: { erg: number };
};
