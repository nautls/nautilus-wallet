import { IAssetInfo } from "@/types/database";
import { ExplorerBox } from "@/types/explorer";
import { AssetStandard, AssetSubtype, AssetType } from "@/types/internal";
import { find, isEmpty } from "lodash";
import { decodeColl, decodeCollTuple, isColl, isTuple } from "../ergo/sigmaSerializer";

export function parseEIP4Asset(tokenId: string, box: ExplorerBox): IAssetInfo | undefined {
  const boxAsset = find(box.assets, (a) => a.tokenId === tokenId);
  if (!boxAsset) {
    return;
  }

  const r5 = decodeColl(box.additionalRegisters.R5);
  const r7 = decodeColl(box.additionalRegisters.R7, "hex");
  const assetInfo: IAssetInfo = {
    id: tokenId,
    mintingBoxId: box.id,
    mintingTransactionId: box.txId,
    emissionAmount: boxAsset.amount.toString(),
    name: boxAsset.name,
    decimals: boxAsset.decimals,
    description: r5,
    type: parseAssetType(r7),
    subtype: parseAssetSubtype(r7),
    standard:
      boxAsset.type === AssetStandard.EIP4 ? AssetStandard.EIP4 : AssetStandard.Unstandardized
  };

  if (assetInfo.type === AssetType.NFT) {
    assetInfo.artworkHash = decodeColl(box.additionalRegisters.R8, "hex");

    if (isColl(box.additionalRegisters.R9)) {
      assetInfo.artworkUrl = decodeColl(box.additionalRegisters.R9);
    } else if (isTuple(box.additionalRegisters.R9)) {
      const [url, cover] = decodeCollTuple(box.additionalRegisters.R9);
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
