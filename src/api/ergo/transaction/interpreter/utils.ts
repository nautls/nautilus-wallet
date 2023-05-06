import { OutputAsset } from "@/api/ergo/transaction/interpreter/outputInterpreter";
import { decimalize, toBigNumber } from "@/utils/bigNumbers";
import { StateAssetInfo } from "@/types/internal";
import { ErgoBoxCandidate, Token } from "@/types/connector";
import { Amount, TokenAmount } from "@fleet-sdk/common";

export const tokensToOutputAssets = (tokens: Token[], assetInfo: StateAssetInfo): OutputAsset[] => {
  return tokens.map((t: Token) => {
    const decimals = assetInfo[t.tokenId]?.decimals ?? 0;
    return {
      tokenId: t.tokenId,
      amount: decimalize(toBigNumber(t.amount), decimals),
      name: assetInfo[t.tokenId]?.name,
      decimals: decimals
    } as OutputAsset;
  });
};

export const boxCandidateToBoxAmounts = (b: ErgoBoxCandidate) => {
  return {
    value: String(b.value),
    assets: b.assets
  };
};

export const tokenAmountToToken = (
  tokenAmount: TokenAmount<Amount>,
  assetInfo: StateAssetInfo
): Token => {
  return {
    tokenId: tokenAmount.tokenId,
    amount: tokenAmount.amount.toString(),
    decimals: assetInfo[tokenAmount.tokenId]?.decimals,
    name: assetInfo[tokenAmount.tokenId]?.name
  };
};

export const sortByTokenId = (tokens: Token[]) =>
  tokens.sort((a, b) => (a.tokenId < b.tokenId ? -1 : 1));
