import { addressesDbService } from "@/api/database/addressesDbService";
import { assetsDbService } from "@/api/database/assetsDbService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import {
  APIError,
  APIErrorCode,
  RpcMessage,
  RpcReturn,
  SelectionTarget,
  Session,
  TokenTargetAmount
} from "@/types/connector";
import { AddressState } from "@/types/internal";
import { sumBigNumberBy, toBigNumber } from "@/utils/bigNumbers";
import { openWindow } from "@/utils/uiHelpers";
import { groupBy, isEmpty } from "lodash";
import { postErrorMessage, postConnectorResponse } from "./messagingUtils";
import JSONBig from "json-bigint";
import { submitTx } from "@/api/ergo/submitTx";
import { fetchBoxes } from "@/api/ergo/boxFetcher";
import { graphQLService } from "@/api/explorer/graphQlService";
import { BoxSelector, ErgoUnsignedInput } from "@fleet-sdk/core";

export async function handleGetBoxesRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateSession(session, request, port) || !session.walletId) {
    return;
  }

  let target: SelectionTarget = { nanoErgs: undefined, tokens: undefined };
  if (request.params) {
    const firstParam = request.params[0];
    if (!firstParam || typeof firstParam === "string") {
      const amount = request.params[0];
      const tokenId = request.params[1];

      if (tokenId === "ERG") {
        target.nanoErgs = amount ? BigInt(amount) : undefined;
      } else {
        target.tokens = [{ tokenId, amount: amount ? BigInt(amount) : undefined }];
      }
    } else {
      const keys = Object.keys(firstParam);
      if (!keys.some((key) => key === "nanoErgs" || key === "tokens")) {
        postErrorMessage(
          {
            code: APIErrorCode.InvalidRequest,
            info: "Invalid target object type."
          },
          request,
          port
        );
      }

      target = {
        nanoErgs: firstParam.nanoErgs,
        tokens: firstParam.tokens.map((x: TokenTargetAmount) => {
          return { tokenId: x.tokenId, amount: x.amount ? BigInt(x.amount) : undefined };
        })
      };
    }

    if (request.params[2]) {
      postErrorMessage(
        {
          code: APIErrorCode.InvalidRequest,
          info: "Pagination is not implemented."
        },
        request,
        port
      );
    }
  }

  console.log("target", target);

  const boxes = await fetchBoxes(session.walletId);
  const selector = new BoxSelector(boxes.map((box) => new ErgoUnsignedInput(box)));

  postConnectorResponse(
    {
      isSuccess: true,
      data: selector.select(target).map((box) => box.toObject("EIP-12"))
    },
    request,
    port
  );
}

export async function handleGetBalanceRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateSession(session, request, port) || !session.walletId) {
    return;
  }

  let tokenId = ERG_TOKEN_ID;
  if (request.params && request.params[0] && request.params[0] !== "ERG") {
    tokenId = request.params[0];
  }

  postConnectorResponse(
    {
      isSuccess: true,
      data: await _getBalance(session.walletId, tokenId)
    },
    request,
    port
  );
}

async function _getBalance(walletId: number, tokenId: string) {
  if (tokenId === "all") {
    const assets = await assetsDbService.getByWalletId(walletId);
    const responseData: { tokenId: string; balance: string }[] = [];
    const groups = groupBy(assets, (x) => x.tokenId);
    for (const tokenId in groups) {
      responseData.push({
        tokenId: tokenId === ERG_TOKEN_ID ? "ERG" : tokenId,
        balance: sumBigNumberBy(groups[tokenId], (x) => toBigNumber(x.confirmedAmount)).toString()
      });
    }

    return responseData;
  }

  const assets = await assetsDbService.getByTokenId(walletId, tokenId);

  return isEmpty(assets)
    ? "0"
    : assets
        .map((a) => toBigNumber(a.confirmedAmount))
        .reduce((acc, val) => acc.plus(val))
        .toString();
}

export async function handleGetAddressesRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session: Session | undefined,
  addressState: AddressState
) {
  if (!validateSession(session, request, port) || !session.walletId) {
    return;
  }

  if (request.params && request.params[0]) {
    postErrorMessage(
      {
        code: APIErrorCode.InvalidRequest,
        info: "Pagination is not implemented."
      },
      request,
      port
    );

    return;
  }

  const addresses = await addressesDbService.getByState(session.walletId, addressState);
  postConnectorResponse(
    {
      isSuccess: true,
      data: addresses.map((x) => x.script)
    },
    request,
    port
  );
}

export async function handleGetChangeAddressRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateSession(session, request, port) || !session.walletId) {
    return;
  }

  const address = await addressesDbService.getChangeAddress(session.walletId);
  if (!address) {
    postErrorMessage(
      {
        code: APIErrorCode.InternalError,
        info: "Change address not found."
      },
      request,
      port
    );

    return;
  }

  postConnectorResponse(
    {
      isSuccess: true,
      data: address.script
    },
    request,
    port
  );
}

export async function handleSignTxRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateSession(session, request, port)) {
    return;
  }

  if (!request.params || !request.params[0]) {
    postErrorMessage(
      {
        code: APIErrorCode.InvalidRequest,
        info: "Unsigned transaction object is undefined."
      },
      request,
      port
    );

    return;
  }

  const response = await openPopup(session, request, port);
  postConnectorResponse(response, request, port);
}

export async function handleAuthRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateSession(session, request, port)) {
    return;
  }

  if (!request.params || !request.params[0] || !request.params[1]) {
    postErrorMessage({ code: APIErrorCode.InvalidRequest, info: "Bad params" }, request, port);
    return;
  }

  const address = request.params[0];
  const addressEntity = await addressesDbService.getByScript(address);
  if (!addressEntity || addressEntity.walletId !== session?.walletId) {
    postErrorMessage(
      {
        code: APIErrorCode.InvalidRequest,
        info: `Address '${address}' does not belong to the connected wallet.`
      },
      request,
      port
    );
    return;
  }

  const response = await openPopup(session, request, port);
  postConnectorResponse(response, request, port);
}

export async function handleSubmitTxRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateSession(session, request, port) || !session.walletId) {
    return;
  }

  if (!request.params || !request.params[0]) {
    postErrorMessage(
      {
        code: APIErrorCode.InvalidRequest,
        info: "Signed transaction object is undefined."
      },
      request,
      port
    );

    return;
  }

  try {
    const tx = request.params[0];
    const txId = await submitTx(
      typeof tx === "string" ? graphQLService.mapTransaction(JSONBig.parse(tx)) : tx,
      session.walletId
    );

    postConnectorResponse(
      {
        isSuccess: true,
        data: txId
      },
      request,
      port
    );
  } catch (e) {
    postErrorMessage(
      {
        code: APIErrorCode.InternalError,
        info: (e as Error).message
      },
      request,
      port
    );
  }
}

export async function handleNotImplementedRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateSession(session, request, port)) {
    return;
  }

  postErrorMessage(
    {
      code: APIErrorCode.InvalidRequest,
      info: "Not implemented."
    },
    request,
    port
  );
}

async function openPopup(
  session: Session,
  message: RpcMessage,
  port: chrome.runtime.Port
): Promise<RpcReturn> {
  return new Promise((resolve, reject) => {
    const tabId = port.sender?.tab?.id;
    if (!tabId || !port.sender?.url) {
      reject("Invalid port.");
      return;
    }

    session.requestQueue.push({ handled: false, message, resolve });
    openWindow(tabId);
  });
}

export function validateSession(
  session: Session | undefined,
  request: RpcMessage,
  port: chrome.runtime.Port
): session is Session {
  let error: APIError | undefined;

  if (!session) {
    error = { code: APIErrorCode.InvalidRequest, info: "Not connected." };
  } else if (session.walletId === undefined) {
    error = { code: APIErrorCode.Refused, info: "Unauthorized." };
  }

  if (error) {
    postErrorMessage(error, request, port);
    return false;
  }

  return true;
}
