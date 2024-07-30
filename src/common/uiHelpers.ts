import { isDefined } from "@fleet-sdk/common";
import { EXT_ENTRY_ROOT } from "../constants/extension";
import { browser } from "./browser";

const POPUP_SIZE = { width: 380, height: 640 };

export async function getBoundsForTabWindow(tabId?: number) {
  if (!browser || !tabId) return undefined;

  const tab = await browser.tabs.get(tabId);
  if (!tab?.windowId) return undefined;

  const window = await browser.windows.get(tab.windowId);
  if (!window) return undefined;

  return { width: window.width, left: window.left, top: window.top };
}

export async function createWindow(tabId?: number) {
  if (!browser) throw Error("Browser API is not available");

  const bounds = await getBoundsForTabWindow(tabId);
  return browser.windows.create({
    ...POPUP_SIZE,
    focused: true,
    type: "popup",
    url: browser.runtime.getURL(`${EXT_ENTRY_ROOT}/connector/index.html`),
    left:
      isDefined(bounds?.width) && isDefined(bounds.left)
        ? bounds?.width + bounds?.left - (POPUP_SIZE.width + 10)
        : undefined,
    top: isDefined(bounds?.top) ? bounds?.top + 50 : undefined
  });
}
