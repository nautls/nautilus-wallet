import { validateAddress } from "@/chains/ergo/addresses";

const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:erg|ergo)$/;
const RESOLVER_URL = import.meta.env.VITE_ERGO_DOMAINS_RESOLVER_URL ?? "http://127.0.0.1:3032";

export type ResolvedErgoDomain = {
  name: string;
  address: string;
  expiryHeight: number;
  tokenId: string;
  recordBoxId: string;
};

export function isErgoDomain(value: string) {
  return DOMAIN_PATTERN.test(value.trim().toLowerCase());
}

export async function resolveErgoDomain(value: string): Promise<ResolvedErgoDomain> {
  const name = value.trim().toLowerCase();
  if (!isErgoDomain(name)) throw new Error("Enter a valid .erg or .ergo name.");

  const response = await fetch(`${RESOLVER_URL}/v1/resolve?name=${encodeURIComponent(name)}`, {
    signal: AbortSignal.timeout(8_000)
  });
  const result = (await response.json().catch(() => ({}))) as Partial<ResolvedErgoDomain> & {
    error?: string;
  };
  if (!response.ok || !result.address) throw new Error(result.error || "This name could not be resolved.");
  if (!validateAddress(result.address)) throw new Error("The resolver returned an invalid Ergo address.");

  return result as ResolvedErgoDomain;
}
