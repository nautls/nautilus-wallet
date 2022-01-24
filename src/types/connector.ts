export type RpcMessage = {
  type:
    | "rpc/connector-response"
    | "rpc/connector-request"
    | "rpc/nautilus-request"
    | "rpc/nautilus-response";
  id: number;
  function?: string;
  params?: any[];
  return?: RpcReturn;
};

export type RpcReturn = {
  isSuccess: boolean;
  data: any;
};
