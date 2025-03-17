import { SIGMA_USD_PARAMETERS } from "@fleet-sdk/ageusd-plugin";
import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";
import { AssetInfo } from "@/types/internal";

export const ERG_INFO: AssetInfo = {
  tokenId: ERG_TOKEN_ID,
  metadata: { name: "ERG", decimals: ERG_DECIMALS }
};

export const SIGUSD_INFO: AssetInfo = {
  tokenId: SIGMA_USD_PARAMETERS.tokens.stableCoinId,
  metadata: { name: "SigUSD", decimals: 2 }
};

export const SIGSRV_INFO: AssetInfo = {
  tokenId: SIGMA_USD_PARAMETERS.tokens.reserveCoinId,
  metadata: { name: "SigRSV" }
};
