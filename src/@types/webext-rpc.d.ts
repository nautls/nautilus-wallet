import { ProtocolWithReturn } from "webext-bridge";
import {
  ExternalRequest,
  InternalEvent,
  InternalMessageData,
  InternalRequest
} from "@/background/messaging";

declare module "webext-bridge" {
  export interface ProtocolMap {
    [ExternalRequest.Connect]: ProtocolWithReturn<{ createErgoObject: boolean }, boolean>;
    [ExternalRequest.CheckConnection]: ProtocolWithReturn<undefined, boolean>;
    [ExternalRequest.Disconnect]: ProtocolWithReturn<undefined, boolean>;

    [InternalRequest.Connect]: ProtocolWithReturn<InternalMessageData, boolean>;
    [InternalRequest.CheckConnection]: ProtocolWithReturn<InternalMessageData, boolean>;
    [InternalRequest.Disconnect]: ProtocolWithReturn<InternalMessageData, boolean>;
    [InternalEvent.Loaded]: undefined;
  }
}
