import { browser, Window } from "./browserApi";

const POPUP_SIZE = { width: 380, height: 640 };

function getDefaultBounds() {
  return {
    width: screen.availWidth,
    positionX: 0,
    positionY: 0
  };
}

function getBoundsForWindow(targetWindow: Window) {
  const defaults = getDefaultBounds();

  return {
    width: targetWindow.width ?? defaults.width,
    positionX: targetWindow.left ?? defaults.positionX,
    positionY: targetWindow.top ?? defaults.positionY
  };
}

export function getBoundsForTabWindow(
  targetTabId?: number
): Promise<{ width: number; positionX: number; positionY: number }> {
  return new Promise(async (resolve) => {
    if (!browser || !targetTabId) return resolve(getDefaultBounds());

    const tab = await browser.tabs.get(targetTabId);
    if (!tab?.windowId) return resolve(getDefaultBounds());

    const window = await browser.windows.get(tab.windowId);
    if (!window) return resolve(getDefaultBounds());

    resolve(getBoundsForWindow(window));
  });
}

export async function openWindow(tabId?: number) {
  if (!tabId || !browser) throw Error("Browser API is not available");

  const bounds = await getBoundsForTabWindow(tabId);
  browser.windows.create({
    ...POPUP_SIZE,
    focused: true,
    type: "popup",
    url: browser.runtime.getURL("index.html"),
    left: bounds.width + bounds.positionX - (POPUP_SIZE.width + 10),
    top: bounds.positionY + 40
  });
}
