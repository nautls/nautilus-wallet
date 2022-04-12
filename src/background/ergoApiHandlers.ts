import { addressesDbService } from "@/api/database/addressesDbService";
import { assestsDbService } from "@/api/database/assetsDbService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { APIError, APIErrorCode, RpcMessage, RpcReturn, Session, ErgoTx } from "@/types/connector";
import { AddressState } from "@/types/internal";
import { toBigNumber } from "@/utils/bigNumbers";
import { openWindow } from "@/utils/uiHelpers";
import BigNumber from "bignumber.js";
import { find, findIndex, isEmpty } from "lodash";
import { postErrorMessage, postConnectorResponse } from "./messagingUtils";
import JSONBig from "json-bigint";
import { submitTx } from "@/api/ergo/submitTx";
import { fetchBoxes } from "@/api/ergo/boxFetcher";

export async function handleGetBoxesRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateRequest(session, request, port)) {
    return;
  }

  let tokenId = ERG_TOKEN_ID;
  let amount = new BigNumber(0);

  if (request.params) {
    tokenId = request.params[1] as string;
    if (!tokenId || tokenId === "ERG") {
      tokenId = ERG_TOKEN_ID;
    }

    let error: APIError | undefined = undefined;

    if (request.params[0]) {
      amount = toBigNumber(request.params[0]) || new BigNumber(0);
    }
    if (request.params[2]) {
      error = {
        code: APIErrorCode.InvalidRequest,
        info: "pagination is not implemented"
      };
    }

    if (error) {
      postErrorMessage(error, request, port);
    }
  }

  let selected = await fetchBoxes(session!.walletId!);

  if (tokenId != ERG_TOKEN_ID) {
    selected = selected.filter((box) => findIndex(box.assets, (a) => a.tokenId === tokenId) > -1);
  }

  if (!amount.isZero()) {
    let acc = new BigNumber(0);

    if (tokenId === ERG_TOKEN_ID) {
      selected = selected.filter((box) => {
        if (acc.isGreaterThanOrEqualTo(amount)) {
          return false;
        }
        acc = acc.plus(toBigNumber(box.value)!);

        return true;
      });
    } else {
      selected = selected.filter((box) => {
        if (acc.isGreaterThanOrEqualTo(amount)) {
          return false;
        }
        acc = acc.plus(toBigNumber(find(box.assets, (a) => a.tokenId === tokenId)?.amount ?? 0)!);

        return true;
      });
    }
  }

  postConnectorResponse(
    {
      isSuccess: true,
      data: selected
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
  if (!validateRequest(session, request, port)) {
    return;
  }

  let tokenId = ERG_TOKEN_ID;
  if (request.params && request.params[0] && request.params[0] !== "ERG") {
    tokenId = request.params[0];
  }

  const assets = await assestsDbService.getByTokenId(session!.walletId!, tokenId);
  postConnectorResponse(
    {
      isSuccess: true,
      data: !isEmpty(assets)
        ? assets
            .map((a) => toBigNumber(a.confirmedAmount)!)
            .reduce((acc, val) => acc.plus(val))
            .toString()
        : "0"
    },
    request,
    port
  );
}

export async function handleGetAddressesRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session: Session | undefined,
  addressState: AddressState
) {
  if (!validateRequest(session, request, port)) {
    return;
  }

  if (request.params && request.params[0]) {
    postErrorMessage(
      {
        code: APIErrorCode.InvalidRequest,
        info: "pagination is not implemented"
      },
      request,
      port
    );

    return;
  }

  const addresses = await addressesDbService.getByState(session!.walletId!, addressState);
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
  if (!validateRequest(session, request, port)) {
    return;
  }

  const address = await addressesDbService.getChangeAddress(session!.walletId!);
  if (!address) {
    postErrorMessage(
      {
        code: APIErrorCode.InternalError,
        info: "change address not found"
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
  if (!validateRequest(session, request, port)) {
    return;
  }

  if (!request.params || !request.params[0]) {
    postErrorMessage(
      {
        code: APIErrorCode.InvalidRequest,
        info: "tx object is not present"
      },
      request,
      port
    );

    return;
  }

  const response = await showSignTxWindow(session!, request, port);
  postConnectorResponse(response, request, port);
}

export async function handleSubmitTxRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateRequest(session, request, port)) {
    return;
  }

  if (!request.params || !request.params[0]) {
    postErrorMessage(
      {
        code: APIErrorCode.InvalidRequest,
        info: "empty tx"
      },
      request,
      port
    );

    return;
  }

  try {
    const tx = request.params[0] as ErgoTx;
    const txId = await submitTx(
      typeof tx === "string" ? (JSONBig.parse(tx) as ErgoTx) : tx,
      session!.walletId!
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
  if (!validateRequest(session, request, port)) {
    return;
  }

  postErrorMessage(
    {
      code: APIErrorCode.InvalidRequest,
      info: "not implemented"
    },
    request,
    port
  );
}

async function showSignTxWindow(
  session: Session,
  message: RpcMessage,
  port: chrome.runtime.Port
): Promise<RpcReturn> {
  return new Promise((resolve, reject) => {
    const tabId = port.sender?.tab?.id;
    if (!tabId || !port.sender?.url) {
      reject("invalid port");
      return;
    }

    session.requestQueue.push({ handled: false, message, resolve });
    openWindow(tabId);
  });
}

export function validateRequest(
  session: Session | undefined,
  request: RpcMessage,
  port: chrome.runtime.Port
): boolean {
  let error: APIError | undefined;

  if (!session) {
    error = { code: APIErrorCode.InvalidRequest, info: "not connected" };
  } else if (session.walletId === undefined) {
    error = { code: APIErrorCode.Refused, info: "unauthorized" };
  }

  if (error) {
    postErrorMessage(error, request, port);
    return false;
  }

  return true;
}
