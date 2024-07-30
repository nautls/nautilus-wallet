import type { ProtocolWithReturn as WithReturn } from "webext-bridge";
import type {
  Box,
  EIP12UnsignedTransaction,
  SignedInput,
  SignedTransaction
} from "@fleet-sdk/common";
import type { AssetBalance, AuthResult, SelectionTarget } from "@nautilus-js/eip12-types";
import type { JsonValue } from "type-fest";
import type {
  AddressType,
  ErrorResult,
  ExternalRequest,
  InternalEvent,
  InternalRequest,
  Result,
  DataWithPayload as WithPayload
} from "@/extension/connector/rpc/protocol";

type UTxOsTarget = { target: SelectionTarget | undefined };
type UTxOResult = Result<Box<string>[]>;

type BalanceArgs = { tokenId?: string };
type BalanceResult = Result<AssetBalance[] | string>;

type AddressesArgs = { filter: AddressType };
type AddressesResult = Result<string[] | string>;

type SignDataArgs = { address: string; message: JsonValue };
type AuthArgs = { address: string; message: string };

type SignTxArgs = { transaction: EIP12UnsignedTransaction };
type SignTxResult = Result<SignedTransaction>;

type SignTxInputsArgs = { transaction: EIP12UnsignedTransaction; indexes: number[] };
type SignTxInputsResult = Result<SignedInput[]>;

type SubmitTxArgs = { transaction: SignedTransaction };
type SubmitTxResult = Result<string>;

declare module "webext-bridge" {
  export interface ProtocolMap {
    [ExternalRequest.Connect]: WithReturn<undefined, boolean>;
    [ExternalRequest.CheckConnection]: WithReturn<undefined, boolean>;
    [ExternalRequest.Disconnect]: WithReturn<undefined, boolean>;

    [ExternalRequest.GetUTxOs]: WithReturn<UTxOsTarget, UTxOResult>;
    [ExternalRequest.GetBalance]: WithReturn<BalanceArgs, BalanceResult>;
    [ExternalRequest.GetAddresses]: WithReturn<AddressType, AddressesResult>;
    [ExternalRequest.GetCurrentHeight]: WithReturn<undefined, Result<number>>;
    [ExternalRequest.SignData]: WithReturn<SignDataArgs, ErrorResult>;
    [ExternalRequest.Auth]: WithReturn<AuthArgs, Result<AuthResult>>;
    [ExternalRequest.SignTx]: WithReturn<SignTxArgs, SignTxResult>;
    [ExternalRequest.SignTxInputs]: WithReturn<SignTxInputsArgs, SignTxInputsResult>;
    [ExternalRequest.SubmitTransaction]: WithReturn<SubmitTxArgs, SubmitTxResult>;

    [InternalRequest.Connect]: WithReturn<WithPayload, boolean>;
    [InternalRequest.CheckConnection]: WithReturn<WithPayload, boolean>;
    [InternalRequest.Disconnect]: WithReturn<WithPayload, boolean>;

    [InternalRequest.GetUTxOs]: WithReturn<WithPayload<UTxOsTarget>, UTxOResult>;
    [InternalRequest.GetBalance]: WithReturn<WithPayload<BalanceArgs>, BalanceResult>;
    [InternalRequest.GetAddresses]: WithReturn<WithPayload<AddressesArgs>, AddressesResult>;
    [InternalRequest.GetCurrentHeight]: WithReturn<WithPayload, Result<number>>;
    [InternalRequest.SignData]: WithReturn<WithPayload<SignDataArgs>, ErrorResult>;
    [InternalRequest.Auth]: WithReturn<WithPayload<AuthArgs>, Result<AuthResult>>;
    [InternalRequest.SignTx]: WithReturn<WithPayload<SignTxArgs>, SignTxResult>;
    [InternalRequest.SignTxInputs]: WithReturn<WithPayload<SignTxInputsArgs>, SignTxInputsResult>;
    [InternalRequest.SubmitTransaction]: WithReturn<WithPayload<SubmitTxArgs>, SubmitTxResult>;

    [InternalEvent.Loaded]: undefined;
    [InternalEvent.UpdatedBackendUrl]: string;
  }
}
