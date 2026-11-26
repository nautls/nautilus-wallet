import type { BlockHeader, Box, SignedTransaction } from "@fleet-sdk/common";
import {
  RelayError,
  RestClient,
  type Status,
  type Submitted,
  type TokenMetadata,
  type WireAssets
} from "@hergmes/sdk";
import { log } from "@/common/logger";
import { getSettings } from "@/extension/background/settings";
import { IAssetInfo } from "@/types/database";
import { AssetStandard, AssetSubtype, AssetType } from "@/types/internal";

export type SpendableBox = Box<string> & { confirmed: boolean };
export type Balances = { nanoErgs: bigint; tokens: Map<string, bigint> };
export type AddressBalance = {
  address: string;
  used: boolean;
  confirmed: Balances;
  pending: Balances;
};

const MAX_CONCURRENT_REQUESTS = 10;
const SUBMIT_VISIBILITY_TIMEOUT = 10_000;
const SUBMIT_VISIBILITY_POLL_INTERVAL = 250;

const TYPES: Record<string, { type: AssetType; subtype?: string }> = {
  "nft-picture": { type: AssetType.NFT, subtype: AssetSubtype.PictureArtwork },
  "nft-audio": { type: AssetType.NFT, subtype: AssetSubtype.AudioArtwork },
  "nft-video": { type: AssetType.NFT, subtype: AssetSubtype.VideoArtwork },
  "nft-artwork-collection": { type: AssetType.NFT, subtype: "0104" },
  "nft-file-attachments": { type: AssetType.NFT, subtype: "010f" },
  nft: { type: AssetType.NFT },
  "membership-threshold-signature": {
    type: AssetType.MembershipToken,
    subtype: AssetSubtype.ThresholdSignature
  }
};

export const MIN_RELAY_VERSION = "0.3.0";
export const NO_RELAY_MESSAGE = "No relay server is set. Set one in settings.";

let client: RestClient | undefined;
let clientUrl: string | undefined;

/**
 * The relay URL is read from storage on every call: the service worker loses in-memory state
 * when idle, and testnet builds ship with no relay, which `RestClient` can't be built with.
 */
async function rest(): Promise<RestClient> {
  const { relayUrl } = await getSettings();
  if (!relayUrl) throw new Error(NO_RELAY_MESSAGE);
  if (!client || clientUrl !== relayUrl) {
    client = new RestClient(relayUrl);
    clientUrl = relayUrl;
  }

  return client;
}

export async function getRelayStatus(url: string): Promise<Status> {
  return new RestClient(url, { maxAttempts: 1 }).status();
}

export async function getHeight(): Promise<number | undefined> {
  try {
    const status = await (await rest()).status();
    return status.tip?.height;
  } catch (e) {
    log.error("Failed to fetch current height", e);
  }
}

export async function getMinValuePerByte(): Promise<number | undefined> {
  try {
    const params = await (await rest()).parameters();
    return params.minValuePerByte;
  } catch (e) {
    log.error("Failed to fetch chain parameters", e);
  }
}

export async function getHeaders(): Promise<BlockHeader[]> {
  const page = await (await rest()).headers({ limit: 10 });
  return page.items;
}

/**
 * Returns `undefined` when the request fails or no token is known, so that callers don't
 * store missing tokens as unknown for good.
 */
export async function getAssetsMetadata(tokenIds: string[]): Promise<IAssetInfo[] | undefined> {
  try {
    const { items } = await (await rest()).tokens(tokenIds);
    if (items.length === 0) return;

    return items.map(parseTokenMetadata);
  } catch (e) {
    log.error("Failed to fetch metadata", tokenIds, e);
  }
}

/** Throws with the node's message if the tx is refused. */
export async function checkTransaction(signedTransaction: SignedTransaction): Promise<void> {
  await (await rest()).submitTransaction(signedTransaction, { broadcast: false });
}

/**
 * Resolves once the relay shows the tx, so that the next tx built from `getSpendableBoxes`
 * neither reuses its inputs nor misses its change: the relay only applies a sent tx at its next
 * mempool poll. A tx the relay is slow to show is reported as sent anyway.
 */
export async function submitTransaction(signedTransaction: SignedTransaction): Promise<Submitted> {
  const relay = await rest();
  const result = await relay.submitTransaction(signedTransaction);
  await waitUntilVisible(relay, signedTransaction);

  return result;
}

async function waitUntilVisible(relay: RestClient, tx: SignedTransaction) {
  const deadline = Date.now() + SUBMIT_VISIBILITY_TIMEOUT;

  for (;;) {
    // the client waits out a 503's Retry-After within one call, past the deadline otherwise
    const signal = AbortSignal.timeout(Math.max(deadline - Date.now(), 1));
    try {
      if (await isFound(relay.mempoolTransaction(tx.id, { signal }))) return;
    } catch (e) {
      log.warn("Stopped waiting for the sent transaction to show up", e);
      return;
    }

    if (Date.now() >= deadline) {
      log.warn(`Sent transaction ${tx.id} is not visible yet.`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, SUBMIT_VISIBILITY_POLL_INTERVAL));
  }
}

async function isFound(request: Promise<unknown>): Promise<boolean> {
  try {
    await request;
    return true;
  } catch (e) {
    if (e instanceof RelayError && e.status === 404) return false;
    throw e;
  }
}

/**
 * What a tx can spend now from each address: confirmed boxes and mempool outputs, less what
 * mempool txs spend.
 */
export async function getSpendableBoxes(addresses: string[]): Promise<SpendableBox[]> {
  const relay = await rest();
  const boxes: SpendableBox[] = [];

  await forEachAddress(addresses, async (address) => {
    const spendable = await relay.spendable(address);
    if (spendable.truncated) {
      log.warn(`Spendable boxes of ${address} were truncated to ${spendable.items.length}.`);
    }

    for (const { inclusionHeight, ...box } of spendable.items) {
      boxes.push({ ...box, confirmed: inclusionHeight !== undefined });
    }
  });

  return boxes;
}

/** The sum of the addresses' balances with the mempool applied: confirmed plus pending. */
export async function getBalances(addresses: string[]): Promise<Balances> {
  const total: Balances = { nanoErgs: 0n, tokens: new Map() };

  for (const { confirmed, pending } of await getAddressBalances(addresses)) {
    for (const assets of [confirmed, pending]) {
      total.nanoErgs += assets.nanoErgs;
      for (const [tokenId, amount] of assets.tokens) {
        total.tokens.set(tokenId, (total.tokens.get(tokenId) ?? 0n) + amount);
      }
    }
  }

  for (const [tokenId, amount] of total.tokens) {
    if (amount <= 0n) total.tokens.delete(tokenId);
  }

  return total;
}

export async function getAddressBalances(addresses: string[]): Promise<AddressBalance[]> {
  const relay = await rest();
  const balances: AddressBalance[] = [];

  await forEachAddress(addresses, async (address) => {
    const { used, confirmed, pending } = await relay.balance(address);
    balances.push({
      address,
      used,
      confirmed: mapAssets(confirmed),
      pending: mapAssets(pending)
    });
  });

  return balances;
}

/**
 * Whether any of the addresses holds a confirmed box created at `height` or before. Only each
 * address's first box is read: boxes come in inclusion order, so it is the oldest one or close.
 */
export async function hasBoxesCreatedBefore(height: number, addresses: string[]): Promise<boolean> {
  const relay = await rest();
  let found = false;

  await forEachAddress(addresses, async (address) => {
    if (found) return;
    const { items } = await relay.boxes({ address }, { limit: 1 });
    if (items.some((box) => box.creationHeight <= height)) found = true;
  });

  return found;
}

function mapAssets(assets: WireAssets): Balances {
  return {
    nanoErgs: BigInt(assets.nanoErgs),
    tokens: new Map(assets.tokens.map((t) => [t.tokenId, BigInt(t.amount)]))
  };
}

/** Requests go a few at a time, to stay within the relay proxy's rate limit. */
async function forEachAddress(addresses: string[], fn: (address: string) => Promise<void>) {
  const queue = [...addresses];
  const worker = async () => {
    for (let address = queue.shift(); address; address = queue.shift()) await fn(address);
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, addresses.length) }, worker)
  );
}

/** Whether `version` is `MIN_RELAY_VERSION` or later; pre-release tags are ignored. */
export function isSupportedRelayVersion(version: string): boolean {
  const parse = (v: string) =>
    v
      .split(/[-+]/)[0]
      .split(".")
      .map((n) => Number.parseInt(n, 10));
  const [actual, min] = [parse(version), parse(MIN_RELAY_VERSION)];

  for (let i = 0; i < min.length; i++) {
    const part = actual[i] ?? 0;
    if (Number.isNaN(part)) return false;
    if (part !== min[i]) return part > min[i];
  }

  return true;
}

function parseTokenMetadata(token: TokenMetadata): IAssetInfo {
  const info: IAssetInfo = {
    id: token.tokenId,
    mintingBoxId: "",
    mintingTransactionId: token.mintingTxId,
    emissionAmount: token.emission,
    decimals: 0,
    type: AssetType.Unknown,
    standard: AssetStandard.Unstandardized
  };

  if (token.standard !== "eip-4") return info;

  const { metadata } = token;
  const type = metadata.type ? TYPES[metadata.type] : undefined;

  return {
    ...info,
    standard: AssetStandard.EIP4,
    name: metadata.name || undefined,
    description: metadata.description || undefined,
    decimals: metadata.decimals,
    type: type?.type ?? AssetType.Unknown,
    subtype: type?.subtype as AssetSubtype | undefined,
    artworkHash: metadata.artworkHash,
    artworkUrl: metadata.artworkUrl,
    artworkCover: metadata.artworkCover
  };
}
