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

export enum SignErrorCode {
  ProofGeneration = 1,
  UserDeclined = 2
}

export type Token = {
  tokenId: string;
  amount: string;
  name?: string;
  decimals?: number;
};

export type Registers = { [key: string]: string };

export type ErgoBoxCandidate = {
  value: string;
  ergoTree: string;
  creationHeight: number;
  assets: Token[];
  additionalRegisters: Registers;
};

export type DataInput = {
  boxId: string;
};

export type TokenTargetAmount = {
  tokenId: string;
  amount?: bigint;
};

export type SelectionTarget = {
  nanoErgs?: bigint;
  tokens?: TokenTargetAmount[];
};
