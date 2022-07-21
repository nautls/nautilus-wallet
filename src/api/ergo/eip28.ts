/**
 * Creates a EIP-28 signing message
 * @param message
 * @param origin
 * @returns the signing message formatted as "signingMessage;origin;timestamp;randomBytes"
 */
export function buildEip28ResponseMessage(message: string, origin: string): string {
  const buffer = Buffer.from(new Uint8Array(32));
  crypto.getRandomValues(buffer);

  return `${message};${origin};${Math.floor(Date.now() / 1000)};${buffer.toString("hex")}`;
}
