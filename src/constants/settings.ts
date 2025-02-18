import { DEFAULT_SERVER_URL } from "@/chains/ergo/services/graphQlService";
import { MAINNET } from "./ergo";
import { DEFAULT_EXPLORER_URL } from "./explorer";

export const DEFAULT_SETTINGS = {
  lastOpenedWalletId: 0,
  isKyaAccepted: false,
  conversionCurrency: "usd",
  devMode: !MAINNET,
  graphQLServer: DEFAULT_SERVER_URL,
  explorerUrl: DEFAULT_EXPLORER_URL,
  hideBalances: false,
  blacklistedTokensLists: ["nsfw", "scam"],
  zeroConf: false,
  colorMode: "auto" as "light" | "dark" | "auto",
  extension: { viewMode: "popup" as "popup" | "sidebar" }
};
