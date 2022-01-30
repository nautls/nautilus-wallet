export type RequestQueueItem = {
  message: RpcMessage;
  handled: boolean;
  resolve: (value: RpcReturn) => void;
};

export type Session = {
  origin: string;
  favicon?: string;
  port: chrome.runtime.Port;
  walletId?: number;
  requestQueue: RequestQueueItem[];
};

export type RpcMessage = {
  type:
    | "rpc/connector-response"
    | "rpc/connector-request"
    | "rpc/nautilus-request"
    | "rpc/nautilus-response";
  sessionId: number;
  requestId: number;
  function: string;
  params?: any[];
  return?: RpcReturn;
};

export type RpcEvent = {
  type: "rpc/nautilus-event";
  name: string;
  data?: any;
};

export type RpcReturn = {
  isSuccess: boolean;
  data?: any;
};

export enum APIErrorCode {
  InvalidRequest = -1,
  InternalError = -2,
  Refused = -3
}

export type APIError = {
  code: APIErrorCode;
  info: string;
};

export enum TxSendErrorCode {
  Refused = 1,
  Failure = 2
}

export type TxSendError = {
  code: TxSendErrorCode;
  info: String;
};

export enum TxSignErrorCode {
  ProofGeneration = 1,
  UserDeclined = 2
}

export type TxSignError = {
  code: TxSignErrorCode;
  info: String;
};

export type Token = {
  tokenId: string;
  amount: number | string;
  name?: string;
  decimals?: number;
};

export type UnsignedInput = {
  boxId: string;
  transactionId: string;
  index: number;
  ergoTree: string;
  creationHeight: number;
  value: number | string;
  assets: Token[];
  additionalRegisters: { [key: string]: string };
  extension: { [key: string]: string };
};

export type ErgoBoxCandidate = {
  readonly value: number | string;
  readonly ergoTree: string;
  readonly creationHeight: number;
  readonly assets: Token[];
  readonly additionalRegisters: { [key: string]: string };
};

export type DataInput = {
  boxId: string;
};

export type UnsignedTx = {
  inputs: UnsignedInput[];
  dataInputs: DataInput[];
  outputs: ErgoBoxCandidate[];
};
