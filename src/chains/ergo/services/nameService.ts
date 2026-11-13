import { hex, sha256, utf8 } from "@fleet-sdk/crypto";
import { addressFromPk, validateAddress } from "@/chains/ergo/addresses";
import { safeSigmaDecode } from "@/chains/ergo/serialization";
import { graphQLService, NameRecordState } from "@/chains/ergo/services/graphQlService";
import { punycode } from "@/common/punycode";
import { MAINNET } from "@/constants/ergo";

/**
 * Mew Names (`alice.erg`, `alice.ergo`), https://names.mewfinance.com. The resolver API answers
 * which record box holds a name, and the wallet confirms that box against its own GraphQL server
 * before using it.
 */
export const NAME_SERVICE_URL = "https://names.mewfinance.com/api";

/**
 * The canonical Mew Names registry. Every value is pinned in the build; moving to another
 * registry means replacing this object.
 */
export type NameRegistry = {
  /** `registry` in the resolver API's answer. */
  id: string;
  /**
   * NFT held by the registrar box. While it is empty no name can be confirmed, so names don't
   * resolve. The end-to-end tests build with a test registry instead.
   */
  registryNftId: string;
  /** SHA-256 of the registrar's ErgoTree bytes. */
  registrarTreeHash: string;
  /** Output of a registration transaction that holds the new name record. */
  recordOutputIndex: number;
  /** SHA-256 of the name record's ErgoTree bytes. */
  recordTreeHash: string;
  /** The furthest expiry the record contract allows past its box's creation height. */
  maxExpiryAhead: number;
};

/** Registry NFT of Registrar V6, set once the registry is created on mainnet. */
const V6_REGISTRY_NFT_ID = "";

export const NAME_REGISTRY: NameRegistry = {
  id: "v6",
  registryNftId: import.meta.env.NAME_REGISTRY_NFT_ID || V6_REGISTRY_NFT_ID,
  // Registrar V6
  registrarTreeHash: "7a1d49f981741bad05be406d3d88a58da0e62bfce260fcd14ace808149a1080b",
  // OUTPUTS(1) when the registrar registers a name (modes 0 and 1); a refresh (mode 2) creates no
  // record box at all
  recordOutputIndex: 1,
  // Name Record V3
  recordTreeHash: "4765fa94ba09cb2b0da3b3a4e5dea413b68bb9781c6298d0020224c7f938b6a7",
  // Name Record V3 allows an expiry at most three renewal periods plus 1,440 blocks ahead; a
  // record beyond that can only come from a storage-rent spend, and the registrar treats it as
  // released.
  maxExpiryAhead: 789_840
};

/** About 30 days. */
export const NAME_EXPIRY_WARNING_BLOCKS = 21_600;

/**
 * The Registrar V6 rule: 1 to 63 characters, counted in code points, of a-z, 0-9, inner hyphens
 * and emoji from U+1F000 to U+1FFFF. No other Unicode, so letters from other scripts that look
 * like a-z can't occur.
 */
const NAME_PATTERN = /^((?!-)(?:[a-z0-9-]|[\u{1F000}-\u{1FFFF}]){1,63}(?<!-))\.(?:erg|ergo)$/u;
const VARIATION_SELECTORS = /[\uFE0E\uFE0F]/gu;
const MAX_DNS_LABEL_LENGTH = 63;

/**
 * Emoji whose DNS form (UTS #46, as in browsers) maps back to the same emoji, as Mew Names lists
 * them. The rest of U+1F000-U+1FFFF is unassigned, not valid in DNS, or maps to other text
 * (U+1F130 to "a"), so it would share a web address with another name.
 */
// prettier-ignore
const WEB_EMOJI: [number, number][] = [
  [0x1f000, 0x1f02b], [0x1f030, 0x1f093], [0x1f0a0, 0x1f0ae], [0x1f0b1, 0x1f0bf],
  [0x1f0c1, 0x1f0cf], [0x1f0d1, 0x1f0f5], [0x1f10b, 0x1f10f], [0x1f12f, 0x1f12f],
  [0x1f150, 0x1f169], [0x1f16d, 0x1f18f], [0x1f191, 0x1f1ad], [0x1f1e6, 0x1f1ff],
  [0x1f260, 0x1f265], [0x1f300, 0x1f6d7], [0x1f6dc, 0x1f6ec], [0x1f6f0, 0x1f6fc],
  [0x1f700, 0x1f776], [0x1f77b, 0x1f7d9], [0x1f7e0, 0x1f7eb], [0x1f7f0, 0x1f7f0],
  [0x1f800, 0x1f80b], [0x1f810, 0x1f847], [0x1f850, 0x1f859], [0x1f860, 0x1f887],
  [0x1f890, 0x1f8ad], [0x1f8b0, 0x1f8b1], [0x1f900, 0x1fa53], [0x1fa60, 0x1fa6d],
  [0x1fa70, 0x1fa7c], [0x1fa80, 0x1fa88], [0x1fa90, 0x1fabd], [0x1fabf, 0x1fac5],
  [0x1face, 0x1fadb], [0x1fae0, 0x1fae8], [0x1faf0, 0x1faf8], [0x1fb00, 0x1fb92],
  [0x1fb94, 0x1fbca]
];

const HEX_ID_PATTERN = /^[0-9a-f]{64}$/;
const SIGMA_PROP_P2PK_PREFIX = "08cd";
const UNRESOLVED_STATUSES = ["not_registered", "expired", "invalid"] as const;

export type UnresolvedNameStatus = (typeof UNRESOLVED_STATUSES)[number];

export type ResolvedName = {
  name: string;
  address: string;
  /** The name's record box the address was read from. */
  recordBoxId: string;
  expiryHeight: number;
  /** Chain height the record was checked at. */
  height: number;
};

export type NameResolution =
  ({ status: "resolved" } & ResolvedName) | { status: UnresolvedNameStatus; name: string };

/**
 * The name could not be checked: the service or the chain could not be read (`unavailable`),
 * or their answers do not agree (`unverified`). Never treat it as "not registered".
 */
export class NameLookupError extends Error {
  constructor(
    readonly reason: "unavailable" | "unverified",
    message: string
  ) {
    super(message);
    this.name = "NameLookupError";
  }
}

type ApiAnswer = {
  name: string;
  address: string;
  expiryHeight: number;
  tokenId: string;
  recordBoxId: string;
  registry: string;
};

type NameServiceOptions = {
  baseUrl?: string;
  fetch?: (url: string) => Promise<Response>;
  getNameRecord?: (tokenId: string, recordBoxId: string) => Promise<NameRecordState>;
  getHeight?: () => Promise<number | undefined>;
  registry?: NameRegistry;
};

/**
 * Trimmed and lowercased, without emoji variation selectors (U+FE0E, U+FE0F): keyboards add them
 * to some emoji, and the name is the same without them.
 */
export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(VARIATION_SELECTORS, "");
}

/**
 * Whether the input is meant as a name rather than an address. Names are mainnet only, and only
 * names with a DNS form of their own are used: not a label that is already a DNS form (`xn--`),
 * not emoji that map to other text, and not one whose DNS label is over 63 characters. Other
 * names can exist on chain, but Mew Names doesn't sell them, and the same web address would
 * stand for two names.
 */
export function isName(value?: string | null): value is string {
  if (!MAINNET || !value) return false;

  const label = NAME_PATTERN.exec(normalizeName(value))?.[1];
  if (!label || label.startsWith("xn--")) return false;

  const emoji = [...label].filter((character) => character.length > 1);
  if (!emoji.length) return true;
  if (!emoji.every((character) => isWebEmoji(character.codePointAt(0)!))) return false;

  return `xn--${punycode(label)}`.length <= MAX_DNS_LABEL_LENGTH;
}

export function createNameService(options: NameServiceOptions = {}) {
  const baseUrl = options.baseUrl ?? NAME_SERVICE_URL;
  const fetchImpl = options.fetch ?? ((url: string) => fetch(url));
  const getNameRecord =
    options.getNameRecord ??
    ((tokenId: string, recordBoxId: string) => graphQLService.getNameRecord(tokenId, recordBoxId));
  const getHeight = options.getHeight ?? (() => graphQLService.getHeight());
  const registry = options.registry ?? NAME_REGISTRY;

  async function query(name: string): Promise<ApiAnswer | { status: UnresolvedNameStatus }> {
    const url = `${baseUrl}/v1/resolve?${new URLSearchParams({ name })}`;

    let response: Response;
    let body: unknown;
    try {
      response = await fetchImpl(url);
      body = await response.json().catch(() => undefined);
    } catch (e) {
      throw new NameLookupError("unavailable", `Name service unreachable: ${String(e)}`);
    }

    if (response.status === 404 && isUnresolvedStatus(body)) return { status: body.status };
    if (!response.ok) {
      throw new NameLookupError("unavailable", `Name service answered ${response.status}`);
    }
    if (!isApiAnswer(body) || body.name !== name) {
      throw new NameLookupError("unverified", "Unexpected name service answer");
    }

    return body;
  }

  /**
   * Whether the registrar issued the record NFT for `name`: the transaction that minted it spent
   * the registrar box, and minted it into the record output of a registration, a record box with
   * that name. The registrar then also made it the only token of its kind.
   */
  function issuedByRegistrar({ mintBox, mint }: NameRecordState, tokenId: string, name: string) {
    if (!mintBox || !mint || mintBox.transactionId !== mint.transactionId) return false;

    const registers = (mintBox.additionalRegisters ?? {}) as Record<string, string | undefined>;
    return (
      mint.inputs.some(
        (box) =>
          treeHash(box.ergoTree) === registry.registrarTreeHash &&
          box.assets.some((asset) => asset.tokenId === registry.registryNftId)
      ) &&
      mintBox.index === registry.recordOutputIndex &&
      treeHash(mintBox.ergoTree) === registry.recordTreeHash &&
      holdsOnly(mintBox.assets, tokenId) &&
      decodeBytes(registers.R7) === hex.encode(utf8.decode(name))
    );
  }

  async function verify(answer: ApiAnswer): Promise<NameResolution> {
    if (answer.registry !== registry.id) {
      throw new NameLookupError("unverified", `Unknown registry ${answer.registry}`);
    }
    if (!registry.registryNftId) {
      throw new NameLookupError("unverified", "The name registry isn't configured");
    }

    let record: NameRecordState;
    let height: number | undefined;
    try {
      [record, height] = await Promise.all([
        getNameRecord(answer.tokenId, answer.recordBoxId),
        getHeight()
      ]);
    } catch (e) {
      throw new NameLookupError("unavailable", `Chain unreachable: ${String(e)}`);
    }
    if (height === undefined) throw new NameLookupError("unavailable", "Chain height unknown");

    const fail = (why: string): never => {
      throw new NameLookupError("unverified", `Name record mismatch: ${why}`);
    };

    if (!issuedByRegistrar(record, answer.tokenId, answer.name)) {
      fail("not issued by the registrar");
    }
    // the NFT is the only one of its kind, so the unspent box holding it is the name's record
    const box = record.recordBox ?? fail("record box spent or missing");
    if (box.boxId !== answer.recordBoxId) fail("record box");
    if (treeHash(box.ergoTree) !== registry.recordTreeHash) fail("contract");
    if (!holdsOnly(box.assets, answer.tokenId)) fail("assets");

    const registers = (box.additionalRegisters ?? {}) as Record<string, string | undefined>;
    if (decodeBytes(registers.R7) !== hex.encode(utf8.decode(answer.name))) fail("name");
    if (decodeP2PKAddress(registers.R5) !== answer.address) fail("address");

    const expiryHeight = decodeNumber(registers.R6);
    if (expiryHeight !== answer.expiryHeight) fail("expiry");

    if (expiryHeight <= height) return { status: "expired", name: answer.name };
    if (expiryHeight > box.creationHeight + registry.maxExpiryAhead) {
      return { status: "invalid", name: answer.name };
    }

    return {
      status: "resolved",
      name: answer.name,
      address: answer.address,
      recordBoxId: box.boxId,
      expiryHeight,
      height
    };
  }

  return {
    /**
     * Resolves a name to the address payments should go to. Throws `NameLookupError` when the
     * name cannot be checked.
     */
    async resolve(input: string): Promise<NameResolution> {
      if (!isName(input)) throw new Error(`Not a name: ${input}`);

      const name = normalizeName(input);
      const answer = await query(name);
      if ("status" in answer) return { status: answer.status, name };

      return verify(answer);
    }
  };
}

export const nameService = createNameService();

function isUnresolvedStatus(body: unknown): body is { status: UnresolvedNameStatus } {
  const status = (body as { status?: unknown } | undefined)?.status;
  return UNRESOLVED_STATUSES.includes(status as UnresolvedNameStatus);
}

function isApiAnswer(body: unknown): body is ApiAnswer {
  const b = body as Partial<ApiAnswer> | undefined;
  return (
    !!b &&
    typeof b.name === "string" &&
    typeof b.address === "string" &&
    isValidAddress(b.address) &&
    Number.isSafeInteger(b.expiryHeight) &&
    typeof b.tokenId === "string" &&
    HEX_ID_PATTERN.test(b.tokenId) &&
    typeof b.recordBoxId === "string" &&
    HEX_ID_PATTERN.test(b.recordBoxId) &&
    typeof b.registry === "string"
  );
}

/** Whether a box holds exactly one unit of `tokenId` and no other token. */
function holdsOnly(assets: { tokenId: string; amount: unknown }[], tokenId: string): boolean {
  return assets.length === 1 && assets[0].tokenId === tokenId && String(assets[0].amount) === "1";
}

function isWebEmoji(codePoint: number): boolean {
  return WEB_EMOJI.some(([low, high]) => codePoint >= low && codePoint <= high);
}

function treeHash(ergoTree: string): string {
  return hex.encode(sha256(hex.decode(ergoTree)));
}

function isValidAddress(address: string): boolean {
  try {
    return validateAddress(address);
  } catch {
    return false;
  }
}

/** Hex of a `Coll[Byte]` register's bytes. */
function decodeBytes(serialized?: string): string | undefined {
  const data = safeSigmaDecode<Uint8Array>(serialized)?.data;
  return data instanceof Uint8Array ? hex.encode(data) : undefined;
}

function decodeNumber(serialized?: string): number {
  const data = safeSigmaDecode<number | bigint>(serialized)?.data;
  return typeof data === "bigint" || typeof data === "number" ? Number(data) : Number.NaN;
}

function decodeP2PKAddress(serialized?: string): string | undefined {
  if (!serialized?.startsWith(SIGMA_PROP_P2PK_PREFIX) || serialized.length !== 70) return;

  try {
    return addressFromPk(serialized.slice(SIGMA_PROP_P2PK_PREFIX.length));
  } catch {
    return;
  }
}
