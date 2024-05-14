import { APIError, RpcMessage, RpcReturn } from "@/types/connector";
import { Runtime } from "webextension-polyfill";

export function postErrorMessage(error: APIError, request: RpcMessage, port: Runtime.Port) {
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
  port: Runtime.Port,
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
