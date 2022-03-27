function getApiInstance() {
  if (typeof browser !== "undefined") {
    return browser;
  } else if (typeof chrome !== "undefined") {
    return chrome;
  }

  return undefined;
}

export const Browser = getApiInstance();
