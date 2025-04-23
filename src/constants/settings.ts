import { DEFAULT_SERVER_URL } from "@/chains/ergo/services/graphQlService";
import { DEFAULT_IPFS_GATEWAY } from "./assets";
import { MAINNET } from "./ergo";
import { DEFAULT_EXPLORER_URL } from "./explorer";

export const DEFAULT_SETTINGS = {
  lastOpenedWalletId: 0,
  isKyaAccepted: false,
  conversionCurrency: "usd",
  devMode: !MAINNET,
  graphQLServer: DEFAULT_SERVER_URL,
  explorerUrl: DEFAULT_EXPLORER_URL,
  ipfsGateway: DEFAULT_IPFS_GATEWAY,
  hideBalances: false,
  blacklistedTokensLists: ["nsfw", "scam"],
  zeroConf: false,
  locale: "auto" as const,
  colorMode: "auto" as const,
  extension: { viewMode: "popup" as const }
};
