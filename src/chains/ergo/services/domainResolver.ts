import { utf8 } from "@fleet-sdk/crypto";
import { validateAddress } from "@/chains/ergo/addresses";
import { extractPkFromSigmaConstant } from "@/chains/ergo/extraction";
import { safeSigmaDecode } from "@/chains/ergo/serialization";
import { addressFromPk } from "../addresses";

const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:erg|ergo)$/;
const EXPLORER_API = "https://api.ergoplatform.com/api/v1";
const EXPLORER_GRAPHQL = "https://gql.ergoplatform.com/";

// SHA-256 fingerprints of the audited V5 registrar and record ErgoTrees.
// Hashes let the wallet verify chain data without embedding the large contracts.
const REGISTRAR_TREE_HASH = "cacfe58e828bda33991e7609bee0edb24d9cd4fe1cf80e884910f22eae7386fa";
const RECORD_TREE_HASH = "29773f60dd05d7abbb8c82b55bb6cc0d8f81f007fb19076656deaee317b922ad";
const REGISTRY_NFT_ID = "d0205941ebcadbef0236d483a8a7a8e354f3ed1add0e470284a13368f671f018";
const REGISTRY_ROLE = "0e184572676f446f6d61696e732c5265676973747261722c5635";
const HISTORY_PAGE_SIZE = 100;
const MAX_HISTORY_PAGES = 20;
const RECORDS_PAGE_SIZE = 200;

type ExplorerRegister = {
  serializedValue?: string;
  renderedValue?: string;
};

type ExplorerAsset = {
  tokenId: string;
  amount: number | string;
};

type ExplorerBox = {
  boxId: string;
  address: string;
  ergoTree: string;
  assets: ExplorerAsset[];
  additionalRegisters?: Record<string, ExplorerRegister | string>;
};

type ExplorerTransaction = {
  inputs: ExplorerBox[];
  outputs: ExplorerBox[];
};

type ExplorerPage<T> = {
  items: T[];
  total: number;
};

type DomainRegistration = {
  name: string;
  tokenId: string;
  recordAddress: string;
};

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

  const registry = await getLiveRegistry();
  const registration = (await getRegistrations(registry.address)).find(
    (registration) => registration.name === name
  );
  if (!registration) throw new Error("This name is not registered in Ergo Domains V5.");

  const record = await getLiveRecord(registration.tokenId, name);
  if (!record) throw new Error("This name does not have an active Ergo Domains record.");

  const expiryHeight = getIntegerRegister(record, "R6");
  if (!expiryHeight) throw new Error("The Ergo Domains record has an invalid expiry height.");

  const currentHeight = await getCurrentHeight();
  if (expiryHeight <= currentHeight) throw new Error("This Ergo Domains name has expired.");

  const publicKey = extractPkFromSigmaConstant(getSerializedRegister(record, "R5"));
  if (!publicKey) throw new Error("The Ergo Domains record has an invalid recipient address.");

  const address = addressFromPk(publicKey);
  if (!validateAddress(address)) throw new Error("The Ergo Domains record resolved to an invalid address.");

  return { name, address, expiryHeight, tokenId: registration.tokenId, recordBoxId: record.boxId };
}

/**
 * Finds active V5 names that currently resolve to one of the supplied wallet addresses.
 * Both the registration history and the live record box are verified before a name is used.
 */
export async function findErgoDomainsForAddresses(addresses: string[]): Promise<ResolvedErgoDomain[]> {
  const wantedAddresses = new Set(addresses.filter(validateAddress));
  if (wantedAddresses.size === 0) return [];

  const registry = await getLiveRegistry();
  const registrations = await getRegistrations(registry.address);
  if (registrations.length === 0) return [];

  const currentHeight = await getCurrentHeight();
  const tokenToRegistration = new Map(registrations.map((registration) => [registration.tokenId, registration]));
  const recordAddresses = [...new Set(registrations.map((registration) => registration.recordAddress))];
  const records = await getActiveRecordBoxes(recordAddresses);
  const domains: ResolvedErgoDomain[] = [];

  for (const record of records) {
    if (!(await treeMatches(record.ergoTree, RECORD_TREE_HASH))) continue;

    const tokenId = record.assets.find((asset) => String(asset.amount) === "1")?.tokenId;
    const registration = tokenId ? tokenToRegistration.get(tokenId) : undefined;
    const expiryHeight = getIntegerRegister(record, "R6");
    const publicKey = extractPkFromSigmaConstant(getSerializedRegister(record, "R5"));
    if (!registration || !expiryHeight || expiryHeight <= currentHeight || !publicKey) continue;
    if (getTextRegister(record, "R7") !== registration.name) continue;

    const address = addressFromPk(publicKey);
    if (!wantedAddresses.has(address)) continue;

    domains.push({
      name: registration.name,
      address,
      expiryHeight,
      tokenId: registration.tokenId,
      recordBoxId: record.boxId
    });
  }

  return domains.sort((a, b) => b.expiryHeight - a.expiryHeight || a.name.localeCompare(b.name));
}

async function getLiveRegistry(): Promise<ExplorerBox> {
  const page = await getExplorer<ExplorerPage<ExplorerBox>>(
    `/boxes/unspent/byTokenId/${REGISTRY_NFT_ID}?offset=0&limit=10`
  );

  for (const box of page.items) {
    if (
      hasToken(box, REGISTRY_NFT_ID) &&
      getSerializedRegister(box, "R4") === REGISTRY_ROLE &&
      (await treeMatches(box.ergoTree, REGISTRAR_TREE_HASH))
    ) {
      return box;
    }
  }

  throw new Error("The Ergo Domains V5 registry singleton could not be verified.");
}

async function getRegistrations(registrarAddress: string): Promise<DomainRegistration[]> {
  const registrations: DomainRegistration[] = [];
  const registeredTokens = new Set<string>();

  for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
    const offset = page * HISTORY_PAGE_SIZE;
    const history = await getExplorer<ExplorerPage<ExplorerTransaction>>(
      `/addresses/${encodeURIComponent(registrarAddress)}/transactions?offset=${offset}&limit=${HISTORY_PAGE_SIZE}`
    );

    for (const transaction of history.items) {
      const registryInput = transaction.inputs.find((box) => hasToken(box, REGISTRY_NFT_ID));
      const nextRegistry = transaction.outputs[0];
      const record = transaction.outputs[1];

      // The registrar contract requires its continuation at output 0 and the newly
      // minted record at output 1. These checks make the index fully chain-derived.
      if (
        !registryInput ||
        !nextRegistry ||
        !record ||
        !hasToken(nextRegistry, REGISTRY_NFT_ID) ||
        getSerializedRegister(nextRegistry, "R4") !== REGISTRY_ROLE ||
        !(await treeMatches(nextRegistry.ergoTree, REGISTRAR_TREE_HASH)) ||
        !(await treeMatches(record.ergoTree, RECORD_TREE_HASH)) ||
        !getTextRegister(record, "R7")
      ) {
        continue;
      }

      const mintedTokenId = transaction.inputs[0]?.boxId;
      const name = getTextRegister(record, "R7")!;
      if (!mintedTokenId || !hasToken(record, mintedTokenId) || registeredTokens.has(mintedTokenId))
        continue;

      registeredTokens.add(mintedTokenId);
      registrations.push({ name, tokenId: mintedTokenId, recordAddress: record.address });
    }

    if (history.items.length < HISTORY_PAGE_SIZE || offset + history.items.length >= history.total)
      break;
  }

  return registrations;
}

async function getLiveRecord(tokenId: string, name: string): Promise<ExplorerBox | undefined> {
  const page = await getExplorer<ExplorerPage<ExplorerBox>>(
    `/boxes/unspent/byTokenId/${tokenId}?offset=0&limit=10`
  );

  for (const box of page.items) {
    if (
      hasToken(box, tokenId) &&
      (await treeMatches(box.ergoTree, RECORD_TREE_HASH)) &&
      getTextRegister(box, "R7") === name
    ) {
      return box;
    }
  }
}

async function getCurrentHeight(): Promise<number> {
  try {
    const response = await fetch(EXPLORER_GRAPHQL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "query CurrentHeight { blockHeaders(take: 1) { height } }" }),
      signal: AbortSignal.timeout(8_000)
    });
    const payload = (await response.json()) as { data?: { blockHeaders?: { height: number }[] } };
    const height = payload.data?.blockHeaders?.[0]?.height;
    if (response.ok && Number.isSafeInteger(height)) return height;
  } catch {
    // The official REST endpoint below is an equivalent Explorer fallback.
  }

  const info = await getExplorer<{ fullHeight?: number; headersHeight?: number }>("/info");
  const height = info.fullHeight ?? info.headersHeight;
  if (!Number.isSafeInteger(height)) throw new Error("Unable to read the current Ergo block height.");
  return height;
}

async function getActiveRecordBoxes(recordAddresses: string[]): Promise<ExplorerBox[]> {
  const records: ExplorerBox[] = [];

  for (let skip = 0; ; skip += RECORDS_PAGE_SIZE) {
    const response = await fetch(EXPLORER_GRAPHQL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query:
          "query ActiveErgoDomainRecords($addresses: [String!], $skip: Int, $take: Int) { boxes(addresses: $addresses, spent: false, skip: $skip, take: $take) { boxId address ergoTree assets { tokenId amount } additionalRegisters } }",
        variables: { addresses: recordAddresses, skip, take: RECORDS_PAGE_SIZE }
      }),
      signal: AbortSignal.timeout(8_000)
    });
    const payload = (await response.json()) as { data?: { boxes?: ExplorerBox[] } };
    if (!response.ok || !payload.data?.boxes) {
      throw new Error("Unable to read active Ergo Domains records from the official GraphQL API.");
    }

    records.push(...payload.data.boxes);
    if (payload.data.boxes.length < RECORDS_PAGE_SIZE) break;
  }

  return records;
}

async function getExplorer<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${EXPLORER_API}${path}`, { signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new Error("Unable to reach the official Ergo Explorer API.");
  }

  if (!response.ok) throw new Error("The official Ergo Explorer API rejected this lookup.");
  return (await response.json()) as T;
}

function hasToken(box: ExplorerBox, tokenId: string) {
  return box.assets?.some((asset) => asset.tokenId === tokenId && String(asset.amount) === "1");
}

function getSerializedRegister(box: ExplorerBox, register: string): string | undefined {
  const value = box.additionalRegisters?.[register];
  return typeof value === "string" ? value : value?.serializedValue;
}

function getTextRegister(box: ExplorerBox, register: string): string | undefined {
  const decoded = safeSigmaDecode<Uint8Array>(getSerializedRegister(box, register));
  return decoded ? utf8.encode(decoded.data) : undefined;
}

function getIntegerRegister(box: ExplorerBox, register: string): number | undefined {
  const rendered = box.additionalRegisters?.[register];
  const value = typeof rendered === "string" ? undefined : rendered?.renderedValue;
  if (value && /^\d+$/.test(value)) {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : undefined;
  }

  const decoded = safeSigmaDecode<number | bigint>(getSerializedRegister(box, register));
  if (!decoded) return;
  const number = Number(decoded.data);
  return Number.isSafeInteger(number) ? number : undefined;
}

async function treeMatches(ergoTree: string, expectedHash: string) {
  const bytes = new TextEncoder().encode(ergoTree.toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hash === expectedHash;
}
