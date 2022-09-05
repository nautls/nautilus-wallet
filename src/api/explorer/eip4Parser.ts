import { Registers } from "@/types/connector";
import { IAssetInfo } from "@/types/database";
import { AssetStandard, AssetSubtype, AssetType } from "@/types/internal";
import { Token } from "@ergo-graphql/types";
import { isEmpty } from "lodash";
import { decodeColl, decodeCollTuple, isColl, isTuple } from "../ergo/sigmaSerializer";

export function parseEIP4Asset(tokenInfo: Token): IAssetInfo | undefined {
  if (!tokenInfo.box) {
    return;
  }

  const registers = tokenInfo.box.additionalRegisters as Registers;
  const type = decodeColl(registers.R7, "hex");
  const assetInfo: IAssetInfo = {
    id: tokenInfo.tokenId,
    mintingBoxId: tokenInfo.boxId,
    mintingTransactionId: tokenInfo.box.transactionId,
    emissionAmount: tokenInfo.emissionAmount,
    name: tokenInfo.name ?? undefined,
    description: tokenInfo.description ?? undefined,
    decimals: tokenInfo.decimals ?? 0,
    type: parseAssetType(type),
    subtype: parseAssetSubtype(type),
    standard:
      tokenInfo.type === AssetStandard.EIP4 ? AssetStandard.EIP4 : AssetStandard.Unstandardized
  };

  if (assetInfo.type === AssetType.NFT) {
    assetInfo.artworkHash = decodeColl(registers.R8, "hex");

    if (isColl(registers.R9)) {
      assetInfo.artworkUrl = decodeColl(registers.R9);
    } else if (isTuple(registers.R9)) {
      const [url, cover] = decodeCollTuple(registers.R9);
      assetInfo.artworkUrl = url;
      assetInfo.artworkCover = cover;
    }
  }

  return assetInfo;
}

function parseAssetSubtype(r7Register?: string): AssetSubtype | undefined {
  if (!r7Register || isEmpty(r7Register)) {
    return;
  }

  return r7Register as AssetSubtype;
}

function parseAssetType(r7Register?: string): AssetType {
  if (!r7Register || isEmpty(r7Register)) {
    return AssetType.Unknown;
  }

  if (r7Register.startsWith(AssetType.NFT)) {
    return AssetType.NFT;
  } else if (r7Register.startsWith(AssetType.MembershipToken)) {
    return AssetType.MembershipToken;
  }

  return AssetType.Unknown;
}
