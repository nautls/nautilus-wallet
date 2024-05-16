import { Registers } from "@/types/connector";
import { IAssetInfo } from "@/types/database";
import { AssetStandard, AssetSubtype, AssetType } from "@/types/internal";
import { Token } from "@ergo-graphql/types";
import { SColl, SConstant, SPair, parse } from "@fleet-sdk/serializer";
import { utf8, hex, Coder } from "@fleet-sdk/crypto";
import { isUndefined, isEmpty } from "@fleet-sdk/common";

function decode<T>(value: string, coder?: Coder<unknown, T>) {
  const v = parse<T>(value, "safe");
  if (isUndefined(v)) return;

  return coder ? coder.encode(v) : v;
}

export function parseEIP4Asset(tokenInfo: Token): IAssetInfo | undefined {
  if (!tokenInfo.box) return;

  const registers = tokenInfo.box.additionalRegisters as Registers;
  const type = decode<string>(registers.R7, hex);
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
    assetInfo.artworkHash = decode(registers.R8, hex);

    const r9 = SConstant.from<Uint8Array | [Uint8Array, Uint8Array]>(registers.R9);
    if (r9.type instanceof SColl) {
      assetInfo.artworkUrl = utf8.encode(r9.data as Uint8Array);
    } else if (r9.type instanceof SPair) {
      const [url, cover] = r9.data as [Uint8Array, Uint8Array];
      assetInfo.artworkUrl = url ? utf8.encode(url) : undefined;
      assetInfo.artworkCover = cover ? utf8.encode(cover) : undefined;
    }
  }

  return assetInfo;
}

function parseAssetSubtype(r7Register?: string): AssetSubtype | undefined {
  if (!r7Register || isEmpty(r7Register)) return;
  return r7Register as AssetSubtype;
}

function parseAssetType(r7Register?: string): AssetType {
  if (!r7Register || isEmpty(r7Register)) return AssetType.Unknown;

  if (r7Register.startsWith(AssetType.NFT)) {
    return AssetType.NFT;
  } else if (r7Register.startsWith(AssetType.MembershipToken)) {
    return AssetType.MembershipToken;
  }

  return AssetType.Unknown;
}
