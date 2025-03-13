import { AgeUSDBankBox, OracleBox, SIGMA_USD_PARAMETERS } from "@fleet-sdk/ageusd-plugin";
import type { BoxSource } from "@fleet-sdk/blockchain-providers";
import type { Box } from "@fleet-sdk/common";
import { graphQLService } from "@/chains/ergo/services/graphQlService";

export async function getBankBox(from: BoxSource): Promise<AgeUSDBankBox | undefined> {
  const tokenId = SIGMA_USD_PARAMETERS.tokens.stableCoinId;
  const ergoTree = SIGMA_USD_PARAMETERS.contract;

  return getSingleton({ tokenId, ergoTree }, from);
}

export async function getOracleBox(from: BoxSource): Promise<OracleBox | undefined> {
  return getSingleton({ tokenId: SIGMA_USD_PARAMETERS.oracle.nftId }, from);
}

interface SingletonQuery {
  tokenId: string;
  ergoTree?: string;
}

async function getSingleton<T extends Box>(
  where: SingletonQuery,
  from: BoxSource
): Promise<T | undefined> {
  for await (const chunk of graphQLService.streamBoxes({ where, from, take: 1 })) {
    if (chunk.length) return chunk[0] as unknown as T;
  }
}
