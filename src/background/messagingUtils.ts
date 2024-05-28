import { APIError, RpcMessage, RpcReturn } from "@/types/connector";
import { Port } from "../utils/browserApi";

export const RPC_NAMESPACE = "0e689455-8013-478d-827e-13e96888576a";

export function buildNamespaceFor(origin: string) {
  return `${RPC_NAMESPACE}/${origin}`;
}

export function postErrorMessage(error: APIError, request: RpcMessage, port: Port) {
  postConnectorResponse(
    {
      isSuccess: false,
      data: error
    },
    request,
    port
  );
}

export function postConnectorResponse(
  response: RpcReturn,
  message: RpcMessage,
  port: Port,
  subType?: string
) {
  const defaultType = "rpc/connector-response";
  port.postMessage({
    type: subType ? `${defaultType}/${subType}` : defaultType,
    params: message.params,
    sessionId: message.sessionId,
    requestId: message.requestId,
    function: message.function,
    return: response
  });
}
