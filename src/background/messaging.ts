import { APIErrorCode } from "@/types/connector";

export const enum ExternalRequest {
  Connect = "ext:connect",
  CheckConnection = "ext:check-connection",
  Disconnect = "ext:disconnect",

  GetUTxOs = "ext:get-utxos",
  GetBalance = "ext:get-balance",
  GetAddresses = "ext:get-addresses",
  GetCurrentHeight = "ext:get-current-height",
  SignTx = "ext:sign-tx",
  SignTxInput = "ext:sign-tx-input",
  SignData = "ext:sign-data"
}

export const enum InternalRequest {
  Connect = "int:connect",
  CheckConnection = "int:check-connection",
  Disconnect = "int:disconnect",

  GetUTxOs = "int:get-utxos",
  GetBalance = "int:get-balance",
  GetAddresses = "int:get-addresses",
  GetCurrentHeight = "int:get-current-height",
  SignTx = "int:sign-tx",
  SignTxInput = "int:sign-tx-input",
  SignData = "int:sign-data",
  Auth = "int:auth"
}

export const enum InternalEvent {
  Loaded = "int:loaded",
  Disconnected = "int:disconnected"
}

export type SuccessResult<T> = { success: true; data: T };
export type ErrorResult = { success: false; error: { code: APIErrorCode; info: string } };
export type Result<T> = SuccessResult<T> | ErrorResult;

export type InternalMessagePayload = {
  origin: string;
  favicon?: string;
  requestId?: number;
};

export type DataWithPayload<T = unknown> = {
  payload: InternalMessagePayload;
} & T;
