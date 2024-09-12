import { Amount, TokenAmount } from "@fleet-sdk/common";
import { OutputAsset } from "@/chains/ergo/transaction/interpreter/outputInterpreter";
import { Token } from "@/types/connector";
import { AssetsMetadataMap } from "@/types/internal";
import { bn, decimalize } from "@/common/bigNumber";

export const tokensToOutputAssets = (
  tokens: Token[],
  metadata: AssetsMetadataMap
): OutputAsset[] => {
  return tokens.map((t: Token) => {
    const decimals = metadata.get(t.tokenId)?.decimals ?? 0;
    return {
      tokenId: t.tokenId,
      amount: decimalize(bn(t.amount), decimals),
      name: metadata.get(t.tokenId)?.name,
      decimals: decimals
    } as OutputAsset;
  });
};

export const tokenAmountToToken = (
  tokenAmount: TokenAmount<Amount>,
  metadata: AssetsMetadataMap
): Token => {
  return {
    tokenId: tokenAmount.tokenId,
    amount: tokenAmount.amount.toString(),
    decimals: metadata.get(tokenAmount.tokenId)?.decimals,
    name: metadata.get(tokenAmount.tokenId)?.name
  };
};
