import { Browser } from "./browserApi";

const POPUP_SIZE = { width: 380, height: 640 };

function getDefaultBounds() {
  return {
    width: screen.availWidth,
    positionX: 0,
    positionY: 0
  };
}

function getBoundsForWindow(targetWindow: chrome.windows.Window) {
  const defaults = getDefaultBounds();
  return {
    width: targetWindow.width ?? defaults.width,
    positionX: targetWindow.left ?? defaults.positionX,
    positionY: targetWindow.top ?? defaults.positionY
  };
}

export function getBoundsForTabWindow(
  targetTabId: any
): Promise<{ width: number; positionX: number; positionY: number }> {
  return new Promise((resolve) => {
    Browser.tabs.get(targetTabId, (tab: chrome.tabs.Tab) => {
      if (!tab) {
        return resolve(getDefaultBounds());
      }

      Browser.windows.get(tab.windowId, (targetWindow: chrome.windows.Window) => {
        if (!targetWindow) {
          return resolve(getDefaultBounds());
        }

        resolve(getBoundsForWindow(targetWindow));
      });
    });
  });
}

export async function openWindow(tabId?: number) {
  const bounds = await getBoundsForTabWindow(tabId);
  Browser.windows.create({
    ...POPUP_SIZE,
    focused: true,
    type: "popup",
    url: Browser.extension.getURL("index.html"),
    left: bounds.width + bounds.positionX - (POPUP_SIZE.width + 10),
    top: bounds.positionY + 40
  });
}
