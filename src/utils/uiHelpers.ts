const POPUP_SIZE = { width: 370, height: 630 };

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
    chrome.tabs.get(targetTabId, (tab) => {
      if (tab == null) {
        return resolve(getDefaultBounds());
      }
      chrome.windows.get(tab.windowId, (targetWindow) => {
        if (targetWindow == null) {
          return resolve(getDefaultBounds());
        }
        resolve(getBoundsForWindow(targetWindow));
      });
    });
  });
}

export async function openWindow(tabId?: number) {
  const bounds = await getBoundsForTabWindow(tabId);
  chrome.windows.create({
    ...POPUP_SIZE,
    focused: true,
    type: "popup",
    url: chrome.extension.getURL("index.html"),
    left: bounds.width + bounds.positionX - (POPUP_SIZE.width + 10),
    top: bounds.positionY + 40
  });
}
