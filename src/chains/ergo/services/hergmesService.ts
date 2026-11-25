import type { BlockHeader, Box, SignedTransaction } from "@fleet-sdk/common";
import {
  RelayError,
  RestClient,
  type Status,
  type Submitted,
  type TokenMetadata
} from "@hergmes/sdk";
import { log } from "@/common/logger";
import { utxosDbService } from "@/database/utxosDbService";
import { getSettings } from "@/extension/background/settings";
import { IAssetInfo } from "@/types/database";
import { AssetStandard, AssetSubtype, AssetType } from "@/types/internal";

export type SpendableBox = Box<string> & { confirmed: boolean };
export type Balances = { nanoErgs: bigint; tokens: Map<string, bigint> };

const MISSING_INPUTS_ERROR =
  "Malformed transaction: Every input of the transaction should be in UTXO.";
const MAX_CONCURRENT_REQUESTS = 4;
const SUBMIT_ATTEMPTS = 5;
const SUBMIT_FIRST_DELAY = 500;

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

/** The oldest relay that serves what the wallet reads: token standards and chain parameters. */
export const MIN_RELAY_VERSION = "0.2.0";

let client: RestClient | undefined;
let clientUrl: string | undefined;

/**
 * The relay URL is read from storage on every call: the service worker loses in-memory state
 * when idle, and testnet builds ship with no relay, which `RestClient` can't be built with.
 */
async function rest(): Promise<RestClient> {
  const { relayUrl } = await getSettings();
  if (!relayUrl) throw new Error("No relay server is set. Set one in settings.");
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

export async function submitTransaction(
  signedTransaction: SignedTransaction,
  walletId?: number
): Promise<Submitted> {
  const relay = await rest();
  // a tx that spends outputs of one we just sent can reach a node that hasn't seen the
  // first one yet, so it's retried while the node answers that its inputs are unknown
  const chained = await utxosDbService.containsAtLeastOneOf(
    signedTransaction.inputs.map((i) => i.boxId)
  );

  let attempts = chained ? SUBMIT_ATTEMPTS : 1;
  let delay = SUBMIT_FIRST_DELAY;
  for (;;) {
    if (chained) await new Promise((resolve) => setTimeout(resolve, delay));

    let result: Submitted;
    try {
      result = await relay.submitTransaction(signedTransaction);
    } catch (e) {
      attempts--;
      if (attempts === 0 || !isMissingInputsError(e)) throw e;
      delay *= 2;
      continue;
    }

    // the tx is sent by now, so failing to track it locally must not report it as refused
    if (walletId) {
      await utxosDbService
        .addFromTx(signedTransaction, walletId)
        .catch((e) => log.error("Failed to track the sent transaction", e));
    }

    return result;
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
  const relay = await rest();
  const total: Balances = { nanoErgs: 0n, tokens: new Map() };

  await forEachAddress(addresses, async (address) => {
    const { confirmed, pending } = await relay.balance(address);
    for (const assets of [confirmed, pending]) {
      total.nanoErgs += BigInt(assets.nanoErgs);
      for (const { tokenId, amount } of assets.tokens) {
        total.tokens.set(tokenId, (total.tokens.get(tokenId) ?? 0n) + BigInt(amount));
      }
    }
  });

  for (const [tokenId, amount] of total.tokens) {
    if (amount <= 0n) total.tokens.delete(tokenId);
  }

  return total;
}

/** `capacity_exceeded` isn't retried by the SDK, so requests go a few at a time. */
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

function isMissingInputsError(e: unknown): boolean {
  return e instanceof RelayError && e.message.startsWith(MISSING_INPUTS_ERROR);
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
