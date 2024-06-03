/**
 * Dynamically loads the browser API instance.
 * @returns The API instance for the browser, or undefined if the browser context is not available.
 */
function getApiInstance(): typeof chrome | undefined {
  if (!hasBrowserContext()) return undefined;
  return chrome;
}

export const browser = getApiInstance();

export function hasBrowserContext() {
  return typeof chrome === "object" && !!chrome.runtime?.id;
}

export function isPopup() {
  if (!browser?.extension) return false;
  return browser?.extension.getViews({ type: "popup" })[0] === self;
}
