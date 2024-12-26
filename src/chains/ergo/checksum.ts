import { blake2b, hex, utf8 } from "@fleet-sdk/crypto";

const CIP4_HASH_PARAMS = {
  dkLen: 64,
  personalization: hex.decode("77616c6c65747320636865636b73756d")
};

/**
 * Calculate CIP-4 image checksum hash for a given Extended Public Key.
 * More info: https://github.com/cardano-foundation/CIPs/tree/master/CIP-0004#imagepart-rationale
 */
export function calcCip4ImageHash(xpk: string): string {
  return hex.encode(blake2b(utf8.decode(xpk), CIP4_HASH_PARAMS));
}
