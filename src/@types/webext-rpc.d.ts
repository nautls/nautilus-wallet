import type { ProtocolWithReturn } from "webext-bridge";
import type {
  DataWithPayload,
  ExternalRequest,
  InternalEvent,
  InternalRequest,
  Result
} from "@/background/messaging";
import type { Box } from "@fleet-sdk/common";
import type { AssetBalance, SelectionTarget } from "@nautilus-js/eip12-types";

type ConnectionPayload = { createErgoObject: boolean };

type UTxOsTarget = { target: SelectionTarget | undefined };
type UTxOResult = Result<Box<string>[]>;

type BalanceArgs = { tokenId?: string };
type BalanceResult = Result<AssetBalance[] | string>;

declare module "webext-bridge" {
  export interface ProtocolMap {
    [ExternalRequest.Connect]: ProtocolWithReturn<ConnectionPayload, boolean>;
    [ExternalRequest.CheckConnection]: ProtocolWithReturn<undefined, boolean>;
    [ExternalRequest.Disconnect]: ProtocolWithReturn<undefined, boolean>;

    [ExternalRequest.GetUTxOs]: ProtocolWithReturn<UTxOsTarget, UTxOResult>;
    [ExternalRequest.GetBalance]: ProtocolWithReturn<BalanceArgs, BalanceResult>;

    [InternalRequest.Connect]: ProtocolWithReturn<DataWithPayload, boolean>;
    [InternalRequest.CheckConnection]: ProtocolWithReturn<DataWithPayload, boolean>;
    [InternalRequest.Disconnect]: ProtocolWithReturn<DataWithPayload, boolean>;

    [InternalRequest.GetUTxOs]: ProtocolWithReturn<DataWithPayload<UTxOsTarget>, UTxOResult>;
    [InternalRequest.GetBalance]: ProtocolWithReturn<DataWithPayload<BalanceArgs>, BalanceResult>;

    [InternalEvent.Loaded]: undefined;
  }
}
