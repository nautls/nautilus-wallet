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
  return new Promise(resolve => {
    chrome.tabs.get(targetTabId, tab => {
      if (tab == null) {
        return resolve(getDefaultBounds());
      }
      chrome.windows.get(tab.windowId, targetWindow => {
        if (targetWindow == null) {
          return resolve(getDefaultBounds());
        }
        resolve(getBoundsForWindow(targetWindow));
      });
    });
  });
}
