import { hex, randomBytes, utf8 } from "@fleet-sdk/crypto";
import { ErgoMessage } from "@fleet-sdk/core";
import { getPrivateDeriver, Prover } from "./transaction/prover";
import { addressesDbService } from "@/database/addressesDbService";

export type AuthPayload = {
  walletId: number;
  password: string;
  addresses: string[];
};

export type UnsignedAuthMessage = {
  message: string;
  origin: string;
};

export type AuthSignedMessage = {
  signedMessage: string;
  proof: string;
};

/**
 * Creates a EIP-28 signing message
 * @param message
 * @param origin
 * @returns the signing message formatted as "signingMessage;origin;timestamp;randomBytes"
 */
export function buildAuthMessage(message: string, origin: string): string {
  const rand = hex.encode(randomBytes(32));
  return `${message};${origin};${Math.floor(Date.now() / 1000)};${rand}`;
}

export async function signMessage(message: ErgoMessage, auth: AuthPayload): Promise<string> {
  const addresses = await addressesDbService.getByWalletIdAndScripts(
    auth.walletId,
    auth.addresses,
    "strict"
  );

  return hex.encode(
    new Prover(await getPrivateDeriver(auth.walletId, auth.password))
      .from(addresses)
      .signMessage(message.serialize().toBytes())
  );
}

export async function signAuthMessage(
  unsigned: UnsignedAuthMessage,
  auth: AuthPayload
): Promise<AuthSignedMessage> {
  const addresses = await addressesDbService.getByWalletIdAndScripts(
    auth.walletId,
    auth.addresses,
    "strict"
  );

  const signedMessage = buildAuthMessage(unsigned.message, unsigned.origin);
  const proof = new Prover(await getPrivateDeriver(auth.walletId, auth.password))
    .from(addresses)
    .signMessage(utf8.decode(signedMessage));

  return { signedMessage, proof: hex.encode(proof) };
}
