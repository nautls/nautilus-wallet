export function mountExtendedPublicKey(publicKey: string, chainCode: string): string {
  return `0488b21e000000000000000000${chainCode}${publicKey}`;
}
