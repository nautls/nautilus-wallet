import { APIError, RpcMessage, RpcReturn } from "@/types/connector";

export function postErrorMessage(error: APIError, request: RpcMessage, port: chrome.runtime.Port) {
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
  port: chrome.runtime.Port
) {
  port.postMessage({
    type: "rpc/connector-response",
    sessionId: message.sessionId,
    requestId: message.requestId,
    function: message.function,
    return: response
  });
}
