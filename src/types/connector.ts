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
