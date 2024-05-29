import type { ProtocolWithReturn as WithReturn } from "webext-bridge";
import type {
  ErrorResult,
  ExternalRequest,
  InternalEvent,
  InternalRequest,
  Result,
  DataWithPayload as WithPayload
} from "@/background/messaging";
import type { Box } from "@fleet-sdk/common";
import type { AssetBalance, SelectionTarget } from "@nautilus-js/eip12-types";
import type { AddressType } from "@/background/ergoApiHandlers";

type ConnectionPayload = { createErgoObject: boolean };

type UTxOsTarget = { target: SelectionTarget | undefined };
type UTxOResult = Result<Box<string>[]>;

type BalanceArgs = { tokenId?: string };
type BalanceResult = Result<AssetBalance[] | string>;

type AddressesArgs = { filter: AddressType };
type AddressesResult = Result<string[] | string>;

declare module "webext-bridge" {
  export interface ProtocolMap {
    [ExternalRequest.Connect]: WithReturn<ConnectionPayload, boolean>;
    [ExternalRequest.CheckConnection]: WithReturn<undefined, boolean>;
    [ExternalRequest.Disconnect]: WithReturn<undefined, boolean>;

    [ExternalRequest.GetUTxOs]: WithReturn<UTxOsTarget, UTxOResult>;
    [ExternalRequest.GetBalance]: WithReturn<BalanceArgs, BalanceResult>;
    [ExternalRequest.GetAddresses]: WithReturn<AddressType, AddressesResult>;
    [ExternalRequest.GetCurrentHeight]: WithReturn<undefined, Result<number>>;
    [ExternalRequest.SignData]: WithReturn<unknown, ErrorResult>;

    [InternalRequest.Connect]: WithReturn<WithPayload, boolean>;
    [InternalRequest.CheckConnection]: WithReturn<WithPayload, boolean>;
    [InternalRequest.Disconnect]: WithReturn<WithPayload, boolean>;

    [InternalRequest.GetUTxOs]: WithReturn<WithPayload<UTxOsTarget>, UTxOResult>;
    [InternalRequest.GetBalance]: WithReturn<WithPayload<BalanceArgs>, BalanceResult>;
    [InternalRequest.GetAddresses]: WithReturn<WithPayload<AddressesArgs>, AddressesResult>;
    [InternalRequest.GetCurrentHeight]: WithReturn<WithPayload, Result<number>>;
    [InternalRequest.SignData]: WithReturn<WithPayload, ErrorResult>;

    [InternalEvent.Loaded]: undefined;
  }
}
