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

type ExplorerBalanceItem = {
  nanoErgs: number | BigNumber;
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

export type ExplorerGetApiV1BlocksResponse = {
  items: [
    {
      id: string;
      blockId: string;
      inclusionHeight: number;
      timestamp: number;
      index: number;
      globalIndex: number;
      numConfirmations: number;
      inputs: [
        {
          boxId: string;
          value: number;
          index: number;
          spendingProof: string;
          outputBlockId: string;
          outputTransactionId: string;
          outputIndex: number;
          outputGlobalIndex: number;
          outputCreatedAt: number;
          outputSettledAt: number;
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
        }
      ];
      dataInputs: [
        {
          boxId: string;
          value: number;
          index: number;
          outputBlockId: string;
          outputTransactionId: string;
          outputIndex: number;
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
        }
      ];
      outputs: [
        {
          boxId: string;
          transactionId: string;
          blockId: string;
          value: number;
          index: number;
          globalIndex: number;
          creationHeight: number;
          settlementHeight: number;
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
      size: number;
    }
  ];
  total: number;
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

export type ExplorerGetUnspentBox = {
  id: string;
  txId: string;
  value: number | string | BigNumber;
  index: number;
  creationHeight: number;
  ergoTree: string;
  address: string;
  assets: ExplorerToken[];
  additionalRegisters: any;
  spentTransactionId: string;
  mainChain: boolean;
};
