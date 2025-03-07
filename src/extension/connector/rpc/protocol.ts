import { APIErrorCode, SignErrorCode, TxSendErrorCode } from "@/types/connector";

export const RPC_NAMESPACE = "0e689455-8013-478d-827e-13e96888576a";

export const enum ExternalRequest {
  Connect = "ext:connect",
  CheckConnection = "ext:check-connection",
  Disconnect = "ext:disconnect",

  GetUTxOs = "ext:get-utxos",
  GetBalance = "ext:get-balance",
  GetAddresses = "ext:get-addresses",
  GetCurrentHeight = "ext:get-current-height",
  SignTx = "ext:sign-tx",
  SignTxInputs = "ext:sign-tx-input",
  SignData = "ext:sign-data",
  Auth = "ext:auth",
  SubmitTransaction = "ext:submit-transaction"
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
  SignTxInputs = "int:sign-tx-input",
  SignData = "int:sign-data",
  Auth = "int:auth",
  SubmitTransaction = "int:submit-transaction"
}

export const enum InternalEvent {
  Loaded = "int:loaded",
  Disconnected = "int:disconnected",
  UpdatedBackendUrl = "int:backend-host-updated"
}

export const enum ExternalEvent {
  Injected = "ergo-wallet:injected"
}

export type SuccessResult<T> = { success: true; data: T };
export type ErrorResult = {
  success: false;
  error: { code: APIErrorCode | SignErrorCode | TxSendErrorCode; info: string };
};
export type Result<T> = SuccessResult<T> | ErrorResult;

export type InternalMessagePayload = {
  origin: string;
  favicon?: string;
};

export type DataWithPayload<T = unknown> = {
  payload: InternalMessagePayload;
} & T;

export type AddressType = "used" | "unused" | "change";

/**
 * Creates a success result object with the specified data.
 *
 * @template T - The type of the data.
 * @param data - The data to be included in the success result.
 * @returns A success result object containing the specified data.
 */
export function success<T>(data: T): SuccessResult<T> {
  return { success: true, data };
}

/**
 * Creates an ErrorResult object with the specified API error code and information.
 * @param code - The API error code.
 * @param info - Additional information about the error.
 * @returns An ErrorResult object with the specified error code and information.
 */
export function error(
  code: APIErrorCode | SignErrorCode | TxSendErrorCode,
  info: string
): ErrorResult {
  return { success: false, error: { code, info } };
}

export function buildNamespaceFor(origin: string) {
  return `${RPC_NAMESPACE}/${origin}`;
}
