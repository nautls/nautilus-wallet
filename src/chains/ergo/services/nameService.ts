import { hex, sha256, utf8 } from "@fleet-sdk/crypto";
import { addressFromPk, validateAddress } from "@/chains/ergo/addresses";
import { safeSigmaDecode } from "@/chains/ergo/serialization";
import { graphQLService, InputBox, UnspentTokenBox } from "@/chains/ergo/services/graphQlService";
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
 * 1 to 63 characters, counted in code points: a-z, 0-9, inner hyphens and emoji from U+1F000 to
 * U+1FFFF. No other Unicode, so letters from other scripts that look like a-z can't occur.
 */
const NAME_PATTERN = /^(?!-)(?:[a-z0-9-]|[\u{1F000}-\u{1FFFF}]){1,63}(?<!-)\.(erg|ergo)$/u;
const VARIATION_SELECTORS = /[\uFE0E\uFE0F]/gu;
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
  getUnspentBoxesByTokenId?: (tokenId: string) => Promise<UnspentTokenBox[]>;
  getSpendingTransactionInputs?: (boxId: string) => Promise<InputBox[] | undefined>;
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

/** Whether the input is meant as a name rather than an address. Names are mainnet only. */
export function isName(value?: string | null): value is string {
  return MAINNET && !!value && NAME_PATTERN.test(normalizeName(value));
}

export function createNameService(options: NameServiceOptions = {}) {
  const baseUrl = options.baseUrl ?? NAME_SERVICE_URL;
  const fetchImpl = options.fetch ?? ((url: string) => fetch(url));
  const getBoxes =
    options.getUnspentBoxesByTokenId ??
    ((tokenId: string) => graphQLService.getUnspentBoxesByTokenId(tokenId));
  const getSpendingInputs =
    options.getSpendingTransactionInputs ??
    ((boxId: string) => graphQLService.getSpendingTransactionInputs(boxId));
  const getHeight = options.getHeight ?? (() => graphQLService.getHeight());
  const registry = options.registry ?? NAME_REGISTRY;
  /** Record NFTs already found to be issued by the registrar. */
  const issued = new Set<string>();

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
   * Whether the registrar issued the record NFT. A new token's id is the id of the first input
   * of the transaction that mints it, so the minting transaction is the one that spent the box
   * with that id, and the registrar box must be one of its inputs.
   */
  async function issuedByRegistrar(tokenId: string): Promise<boolean> {
    if (issued.has(tokenId)) return true;

    const inputs = await getSpendingInputs(tokenId);
    const fromRegistrar = !!inputs?.some(
      (box) =>
        treeHash(box.ergoTree) === registry.registrarTreeHash &&
        box.assets.some((asset) => asset.tokenId === registry.registryNftId)
    );
    if (fromRegistrar) issued.add(tokenId);

    return fromRegistrar;
  }

  async function verify(answer: ApiAnswer): Promise<NameResolution> {
    if (answer.registry !== registry.id) {
      throw new NameLookupError("unverified", `Unknown registry ${answer.registry}`);
    }
    if (!registry.registryNftId) {
      throw new NameLookupError("unverified", "The name registry isn't configured");
    }

    let boxes: UnspentTokenBox[];
    let height: number | undefined;
    let fromRegistrar: boolean;
    try {
      [boxes, height, fromRegistrar] = await Promise.all([
        getBoxes(answer.tokenId),
        getHeight(),
        issuedByRegistrar(answer.tokenId)
      ]);
    } catch (e) {
      throw new NameLookupError("unavailable", `Chain unreachable: ${String(e)}`);
    }
    if (height === undefined) throw new NameLookupError("unavailable", "Chain height unknown");

    const fail = (why: string): never => {
      throw new NameLookupError("unverified", `Name record mismatch: ${why}`);
    };

    if (!fromRegistrar) fail("not issued by the registrar");
    if (boxes.length !== 1) fail("expected one unspent box");
    const [box] = boxes;
    if (box.boxId !== answer.recordBoxId) fail("record box");
    if (treeHash(box.ergoTree) !== registry.recordTreeHash) fail("contract");
    if (
      box.assets.length !== 1 ||
      box.assets[0].tokenId !== answer.tokenId ||
      String(box.assets[0].amount) !== "1"
    ) {
      fail("assets");
    }

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
