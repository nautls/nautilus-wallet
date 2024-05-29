import { addressesDbService } from "@/api/database/addressesDbService";
import { assetsDbService } from "@/api/database/assetsDbService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { APIError, APIErrorCode, RpcMessage, RpcReturn, Session } from "@/types/connector";
import { AddressState } from "@/types/internal";
import { sumBigNumberBy } from "@/utils/bigNumbers";
import { openWindow } from "@/utils/uiHelpers";
import { groupBy } from "lodash-es";
import { postConnectorResponse, postErrorMessage } from "./messagingUtils";
import JSONBig from "json-bigint";
import { submitTx } from "@/api/ergo/submitTx";
import { graphQLService } from "@/api/explorer/graphQlService";
import { Port } from "../utils/browserApi";
import BigNumber from "bignumber.js";
import { Box, some } from "@fleet-sdk/common";
import type { AssetBalance } from "@nautilus-js/eip12-types";
import { BoxSelector, ErgoUnsignedInput } from "@fleet-sdk/core";
import { fetchBoxes } from "../api/ergo/boxFetcher";
import { SelectionTarget } from "@nautilus-js/eip12-types";

export async function getUTxOs(walletId: number, target?: SelectionTarget): Promise<Box<string>[]> {
  const boxes = await fetchBoxes(walletId);
  const selector = new BoxSelector(boxes.map((box) => new ErgoUnsignedInput(box))).orderBy(
    (box) => box.creationHeight
  );

  let selection!: ErgoUnsignedInput[];
  const selectionTarget = {
    nanoErgs: target?.nanoErgs ? BigInt(target.nanoErgs) : undefined,
    tokens:
      target?.tokens?.map((x) => ({
        tokenId: x.tokenId,
        amount: x.amount ? BigInt(x.amount) : undefined
      })) || []
  };

  try {
    selection = selector.select(selectionTarget);
  } catch {
    selection = [];
  }

  return selection.map((box) => ({
    ...box.toPlainObject("EIP-12"),
    confirmed: boxes.find((x) => x.boxId === box.boxId)?.confirmed || false
  }));
}

export async function getBalance(walletId: number, tokenId: string) {
  if (tokenId !== "all") {
    const assets = await assetsDbService.getByTokenId(walletId, tokenId);
    return some(assets)
      ? assets
          .map((a) => BigNumber(a.confirmedAmount))
          .reduce((acc, val) => acc.plus(val))
          .toString()
      : "0";
  }

  const assets = await assetsDbService.getByWalletId(walletId);
  const balances: AssetBalance[] = [];
  const groups = groupBy(assets, (x) => x.tokenId);
  for (const tokenId in groups) {
    balances.push({
      tokenId: tokenId === ERG_TOKEN_ID ? "ERG" : tokenId,
      balance: sumBigNumberBy(groups[tokenId], (x) => BigNumber(x.confirmedAmount)).toString()
    });
  }

  return balances;
}

export type AddressType = "used" | "unused" | "change";

export async function getAddresses(walletId: number, filter: AddressType) {
  if (filter === "change") {
    const address = await addressesDbService.getChangeAddress(walletId);
    return address?.script;
  }

  const state = filter === "used" ? AddressState.Used : AddressState.Unused;
  const addresses = await addressesDbService.getByState(walletId, state);
  return addresses.map((x) => x.script);
}

export async function handleSignTxRequest(request: RpcMessage, port: Port, session?: Session) {
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

export async function handleAuthRequest(request: RpcMessage, port: Port, session?: Session) {
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

export async function getCurrentHeight() {
  return graphQLService.getCurrentHeight();
}

export async function handleSubmitTxRequest(request: RpcMessage, port: Port, session?: Session) {
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

async function openPopup(session: Session, message: RpcMessage, port: Port): Promise<RpcReturn> {
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
  port: Port
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
