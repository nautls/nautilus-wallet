import type Transport from "@ledgerhq/hw-transport";
import WebHIDTransport from "@ledgerhq/hw-transport-webhid";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";

export type TransportType = "webhid" | "webusb";

export function createTransport(type: TransportType): Promise<Transport> {
  if (type === "webhid") {
    return WebHIDTransport.create();
  }
  return WebUSBTransport.create();
}
