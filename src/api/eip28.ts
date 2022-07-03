/**
 * Creates a EIP-28 signing message
 * @param message
 * @param origin
 * @returns the signing message formatted as "signingMessage;origin;timestamp;randomBytes"
 */
export function buildEip28ResponseMessage(message: string, origin: string): string {
  return `${message};${origin};${Math.floor(Date.now() / 1000)};${crypto.randomUUID()}`;
}
