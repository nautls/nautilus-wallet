import { addressesDbService } from "@/api/database/addressesDbService";
import { assestsDbService } from "@/api/database/assetsDbService";
import { explorerService } from "@/api/explorer/explorerService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { APIError, APIErrorCode, RpcMessage, Session } from "@/types/connector";
import { AddressState } from "@/types/internal";
import { toBigNumber } from "@/utils/bigNumbers";
import { uniq } from "lodash";
import { postErrorMessage, postResponse } from "./messagingUtils";

export async function handleGetBoxesRequest(
  request: RpcMessage,
  port: chrome.runtime.Port,
  session?: Session
) {
  if (!validateRequest(session, request, port)) {
    return;
  }

  let tokenId = ERG_TOKEN_ID;

  if (request.params) {
    tokenId = request.params[1] as string;
    if (!tokenId || tokenId === "ERG") {
      tokenId = ERG_TOKEN_ID;
    }

    let error: APIError | undefined = undefined;

    if (request.params[0]) {
      error = {
        code: APIErrorCode.InvalidRequest,
        info: "box query per amount is not implemented"
      };
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

  const assets = await assestsDbService.getByTokenId(session!.walletId!, tokenId);
  const addresses = uniq(assets.map((a) => a.address));
  const boxes = await explorerService.getUnspentBoxes(addresses);
  postResponse({ isSuccess: true, data: boxes.map((b) => b.data).flat() }, request, port);
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
  postResponse(
    {
      isSuccess: true,
      data: assets.map((a) => toBigNumber(a.confirmedAmount)!).reduce((acc, val) => acc.plus(val))
    },
    request,
    port
  );
}

export async function handleGetUsedAddressesRequest(
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
  postResponse(
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
  session: Session | undefined
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

  postResponse(
    {
      isSuccess: true,
      data: address.script
    },
    request,
    port
  );
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
    error = { code: APIErrorCode.Refused, info: "not authorized" };
  }

  if (error) {
    postErrorMessage(error, request, port);
    return false;
  }

  return true;
}
