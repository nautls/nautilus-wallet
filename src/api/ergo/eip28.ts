import { hex, randomBytes } from "@fleet-sdk/crypto";

/**
 * Creates a EIP-28 signing message
 * @param message
 * @param origin
 * @returns the signing message formatted as "signingMessage;origin;timestamp;randomBytes"
 */
export function buildEip28ResponseMessage(message: string, origin: string): string {
  const rand = hex.encode(randomBytes(32));
  return `${message};${origin};${Math.floor(Date.now() / 1000)};${rand}`;
}
