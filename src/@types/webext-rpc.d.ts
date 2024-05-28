import { ProtocolWithReturn } from "webext-bridge";
import {
  ExternalRequest,
  InternalEvent,
  InternalMessageData,
  InternalRequest
} from "@/background/messaging";

declare module "webext-bridge" {
  export interface ProtocolMap {
    [ExternalRequest.Test]: ProtocolWithReturn<{ foo: string }, string>;
    [InternalRequest.Test]: ProtocolWithReturn<InternalMessageData, string>;
    "popup:loaded": MessageBase;

    [ExternalRequest.Connect]: ProtocolWithReturn<{ createErgoObject: boolean }, boolean>;

    [InternalRequest.Connect]: ProtocolWithReturn<InternalMessageData, boolean>;

    [InternalEvent.Loaded]: undefined;
  }
}
