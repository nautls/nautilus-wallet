import { MAINNET } from "./ergo";

/** Testnet has no public relay, so users set their own. */
export const DEFAULT_RELAY_URL = MAINNET ? "https://hergmes.nautiluswallet.com" : "";

export const DEFAULT_SETTINGS = {
  lastOpenedWalletId: 0,
  conversionCurrency: "usd",
  devMode: !MAINNET,
  relayUrl: DEFAULT_RELAY_URL,
  explorerUrl: MAINNET ? "https://sigmaspace.io/en" : "https://testnet.ergoplatform.com",
  ipfsGateway: "https://ipfs.io/ipfs/",
  hideBalances: false,
  blacklistedTokensLists: ["nsfw", "scam"],
  locale: "auto" as const,
  colorMode: "auto" as const,
  extension: { viewMode: "popup" as const },
  ledger: { transport: "webhid" as const },
  masterPasswordAlertDismissed: false
};
