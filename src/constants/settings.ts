import { DEFAULT_SERVER_URL } from "@/chains/ergo/services/graphQlService";
import { MAINNET } from "./ergo";

export const DEFAULT_SETTINGS = {
  lastOpenedWalletId: 0,
  isKyaAccepted: false,
  conversionCurrency: "usd",
  devMode: !MAINNET,
  graphQLServer: DEFAULT_SERVER_URL,
  explorerUrl: MAINNET ? "https://sigmaspace.io/en" : "https://testnet.ergoplatform.com",
  ipfsGateway: "https://ipfs.io/ipfs/",
  hideBalances: false,
  blacklistedTokensLists: ["nsfw", "scam"],
  zeroConf: false,
  locale: "auto" as const,
  colorMode: "auto" as const,
  extension: { viewMode: "popup" as const }
};
