import type Transport from "@ledgerhq/hw-transport";
import WebHIDTransport from "@ledgerhq/hw-transport-webhid";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import { Buffer } from "buffer";

// @ledgerhq/* and ledger-ergo-js packages expect `Buffer` to be globally available
globalThis.Buffer ??= Buffer;

export type TransportType = "webhid" | "webusb";

export function createTransport(type: TransportType): Promise<Transport> {
  if (type === "webhid") {
    return WebHIDTransport.create();
  }
  return WebUSBTransport.create();
}
