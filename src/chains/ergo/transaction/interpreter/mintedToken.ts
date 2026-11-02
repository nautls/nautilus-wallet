import { first, isEmpty } from "@fleet-sdk/common";
import { utf8 } from "@fleet-sdk/crypto";
import { decode } from "@fleet-sdk/serializer";
import { ErgoBoxCandidate } from "@/types/connector";
import { BasicAssetMetadata } from "@/types/internal";

export type MintedToken = {
  tokenId: string;
  /** Total emission amount across all outputs, in the token's smallest unit. */
  emissionAmount: bigint;
  /** EIP-4 metadata, if the minting box carries it. */
  metadata?: BasicAssetMetadata;
};

/**
 * Detects the token being minted by a transaction. Per Ergo rules, a new token's ID
 * equals the ID of the transaction's first input, and its EIP-4 metadata lives in the
 * registers of the box receiving it.
 */
export function findMintedToken(
  inputs: { boxId: string }[],
  outputs: ErgoBoxCandidate[]
): MintedToken | undefined {
  const tokenId = first(inputs)?.boxId;
  if (!tokenId) return;

  let emissionAmount = 0n;
  let metadataBox: ErgoBoxCandidate | undefined;
  for (const output of outputs) {
    for (const asset of output.assets) {
      if (asset.tokenId !== tokenId) continue;
      emissionAmount += BigInt(asset.amount);
      metadataBox ??= output;
    }
  }

  if (!metadataBox) return;
  return { tokenId, emissionAmount, metadata: decodeEip4Metadata(metadataBox) };
}

function decodeEip4Metadata(box: ErgoBoxCandidate): BasicAssetMetadata | undefined {
  const registers = box.additionalRegisters;
  if (isEmpty(registers)) return;

  return {
    name: decodeUtf8(registers.R4) ?? "",
    description: decodeUtf8(registers.R5) ?? "",
    decimals: decodeDecimals(registers.R6)
  };
}

function safeDecode(value?: string) {
  if (!value) return;

  try {
    return decode(value);
  } catch {
    return;
  }
}

function decodeUtf8(value?: string): string | undefined {
  const r = safeDecode(value);
  if (!r || r.type.toString() !== "SColl[SByte]") return;

  return utf8.encode(r.data as Uint8Array);
}

function decodeDecimals(value?: string): number | undefined {
  const r6 = safeDecode(value);
  if (!r6) return;

  const decimals =
    r6.type.toString() === "SColl[SByte]"
      ? Number.parseInt(utf8.encode(r6.data as Uint8Array), 10)
      : Number(r6.data);

  return Number.isSafeInteger(decimals) && decimals >= 0 ? decimals : undefined;
}
