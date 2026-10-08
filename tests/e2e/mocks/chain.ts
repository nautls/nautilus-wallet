import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { SignedTransaction } from "@fleet-sdk/common";
import { ErgoAddress, ErgoBox } from "@fleet-sdk/core";
import type { BrowserContext, Route } from "@playwright/test";

/**
 * GraphQL endpoints the wallet may talk to, both from extension pages and from the
 * background service worker. All of them are served by the same in-memory chain.
 */
export const GRAPHQL_URLS = [
  "https://explore.sigmaspace.io/api/graphql",
  "https://gql.ergoplatform.com/",
  "https://graphql.erg.zelcore.io/"
];

/** Address used as the counterparty of funding transactions. */
export const EXTERNAL_ADDRESS = "9iPgSVU3yrRnTxtJC6hYA7bS5mMqZtjeJHrT3fNdLV7JZVpY5By";

type Asset = { tokenId: string; amount: string };
type Registers = Record<string, string>;

export type GqlBox = {
  boxId: string;
  transactionId: string;
  index: number;
  value: string;
  creationHeight: number;
  ergoTree: string;
  assets: Asset[];
  additionalRegisters: Registers;
};

type GqlInput = {
  proofBytes: string;
  extension: Record<string, string>;
  index: number;
  box: GqlBox;
};

export type GqlTransaction = {
  transactionId: string;
  timestamp: string;
  inputs: GqlInput[];
  dataInputs: { boxId: string }[];
  outputs: GqlBox[];
  inclusionHeight?: number;
  headerId?: string;
  index?: number;
};

export type TokenMetadata = {
  tokenId: string;
  name: string;
  decimals?: number;
  description?: string;
  emissionAmount?: string;
  registers?: Registers;
};

type GqlRequest = { operationName?: string; query: string; variables?: Record<string, unknown> };

export type BoxOptions = {
  nanoErgs: bigint | string;
  tokens?: Asset[];
  creationHeight?: number;
  registers?: Registers;
};

const HEADERS: { height: number }[] = JSON.parse(
  readFileSync(new URL("../fixtures/data/headers.json", import.meta.url), "utf8")
).data.blockHeaders;
const hex32 = () => randomBytes(32).toString("hex");
const treeOf = (address: string) => ErgoAddress.decode(address).ergoTree;

/**
 * In-memory Ergo blockchain served through a GraphQL API compatible with ergo-graphql.
 * Tests mutate its state (fund addresses, add tokens, push mempool transactions, ...)
 * and the wallet reads it through intercepted HTTP requests.
 */
export class MockChain {
  height = HEADERS[0].height;
  network = "mainnet";
  version = "0.5.1";

  /** When set, `submitTransaction` and `checkTransaction` fail with this message. */
  submitError?: string;

  /** Every signed transaction successfully submitted to the chain. */
  readonly submitted: SignedTransaction[] = [];

  /** Log of every GraphQL operation received, useful for assertions. */
  readonly operations: { name: string; variables: Record<string, unknown> }[] = [];

  #unspent: GqlBox[] = [];
  #confirmed: GqlTransaction[] = [];
  #mempool: GqlTransaction[] = [];
  #tokens = new Map<string, TokenMetadata>();
  #used = new Set<string>();

  /**
   * Creates a confirmed transaction sending the given assets from an external address
   * to `address`. Returns the created box.
   */
  fund(address: string, opt: BoxOptions): GqlBox {
    const height = opt.creationHeight ?? this.height - 10;
    const transactionId = hex32();
    const output = this.#createBox(treeOf(address), opt, transactionId, 0, height);
    const input = this.#createBox(
      treeOf(EXTERNAL_ADDRESS),
      { ...opt, nanoErgs: BigInt(opt.nanoErgs) + 1_100_000n },
      hex32(),
      0,
      height - 100
    );

    this.#confirmed.push({
      transactionId,
      timestamp: String(Date.now() - (this.height - height) * 120_000),
      inputs: [{ proofBytes: "", extension: {}, index: 0, box: input }],
      dataInputs: [],
      outputs: [output],
      inclusionHeight: height,
      headerId: hex32(),
      index: 0
    });

    this.#unspent.push(output);
    this.#used.add(address);

    return output;
  }

  /** Adds an arbitrary unspent box, e.g. a contract box snapshotted from mainnet. */
  addBox(box: GqlBox) {
    this.#unspent.push(box);
  }

  /** Advances the chain height. */
  mine(blocks = 1) {
    this.height += blocks;
  }

  /** Registers token metadata, as returned by the `tokens` query. */
  addToken(token: TokenMetadata) {
    this.#tokens.set(token.tokenId, token);
  }

  /** Marks an address as used even if it holds no boxes. */
  markUsed(address: string) {
    this.#used.add(address);
  }

  /** Unspent confirmed boxes owned by `address`. */
  boxesOf(address: string): GqlBox[] {
    const tree = treeOf(address);
    return this.#unspent.filter((b) => b.ergoTree === tree);
  }

  get mempool(): readonly GqlTransaction[] {
    return this.#mempool;
  }

  /** Count of operations received with the given name. */
  count(operationName: string) {
    return this.operations.filter((x) => x.name === operationName).length;
  }

  async install(context: BrowserContext) {
    for (const url of GRAPHQL_URLS) {
      await context.route(url, (route) => this.#handle(route));
    }
  }

  async #handle(route: Route) {
    if (route.request().method() !== "POST") return route.fulfill({ status: 405 });

    const body = route.request().postDataJSON() as GqlRequest;
    const name = body.operationName ?? "";
    const vars = body.variables ?? {};
    this.operations.push({ name, variables: vars });

    try {
      const data = this.#resolve(name, body.query, vars);
      await route.fulfill({ json: { data } });
    } catch (e) {
      await route.fulfill({ json: { data: null, errors: [{ message: (e as Error).message }] } });
    }
  }

  #resolve(name: string, query: string, vars: Record<string, unknown>): unknown {
    switch (name) {
      case "info":
        return { info: { version: this.version }, state: { network: this.network } };
      case "currentHeight":
        return { blockHeaders: [{ height: this.height }] };
      case "blockHeaders":
        return { blockHeaders: HEADERS.slice(0, (vars.take as number) ?? 10) };
      case "addresses":
        return { addresses: (vars.addresses as string[]).map((a) => this.#addressInfo(a)) };
      case "oldBoxesCheck":
        return { boxes: this.#oldBoxes(vars.maxHeight as number, vars.addresses as string[]) };
      case "Tokens":
        return { tokens: this.#tokenInfo(vars.tokenIds as string[]) };
      case "mempoolTxCheck":
        return { mempool: { transactions: this.#mempoolLookup(vars.transactionIds as string[]) } };
      case "boxes":
        return this.#boxes(query, vars);
      case "confirmedTransactions":
        return { transactions: this.#transactions(this.#confirmed, vars) };
      case "unconfirmedTransactions":
        return { mempool: { transactions: this.#transactions(this.#mempool, vars) } };
      case "checkTransaction":
        return { checkTransaction: this.#check(vars.signedTransaction as SignedTransaction) };
      case "submitTransaction":
        return { submitTransaction: this.#submit(vars.signedTransaction as SignedTransaction) };
      default:
        throw new Error(`MockChain: unsupported operation '${name}'`);
    }
  }

  #createBox(
    ergoTree: string,
    opt: BoxOptions,
    transactionId: string,
    index: number,
    creationHeight: number
  ): GqlBox {
    const candidate = {
      value: BigInt(opt.nanoErgs),
      ergoTree,
      creationHeight,
      assets: (opt.tokens ?? []).map((t) => ({ tokenId: t.tokenId, amount: BigInt(t.amount) })),
      additionalRegisters: opt.registers ?? {}
    };

    return {
      boxId: new ErgoBox(candidate, transactionId, index).boxId,
      transactionId,
      index,
      value: candidate.value.toString(),
      creationHeight,
      ergoTree,
      assets: opt.tokens ?? [],
      additionalRegisters: opt.registers ?? {}
    };
  }

  #addressInfo(address: string) {
    const boxes = this.boxesOf(address);
    const tokens = new Map<string, bigint>();
    let nanoErgs = 0n;
    for (const box of boxes) {
      nanoErgs += BigInt(box.value);
      for (const t of box.assets)
        tokens.set(t.tokenId, (tokens.get(t.tokenId) ?? 0n) + BigInt(t.amount));
    }

    return {
      address,
      used: this.#used.has(address) || boxes.length > 0,
      balance: {
        nanoErgs: nanoErgs.toString(),
        assets: [...tokens].map(([tokenId, amount]) => ({ tokenId, amount: amount.toString() }))
      }
    };
  }

  #oldBoxes(maxHeight: number, addresses: string[]) {
    const trees = new Set(addresses.map(treeOf));
    return this.#unspent
      .filter((b) => trees.has(b.ergoTree) && b.creationHeight <= maxHeight)
      .slice(0, 1)
      .map((b) => ({ creationHeight: b.creationHeight }));
  }

  #tokenInfo(tokenIds: string[]) {
    return tokenIds
      .map((id) => this.#tokens.get(id))
      .filter((t): t is TokenMetadata => !!t)
      .map((t) => ({
        tokenId: t.tokenId,
        type: "EIP-004",
        emissionAmount: t.emissionAmount ?? "1000000",
        name: t.name,
        description: t.description ?? "",
        decimals: t.decimals ?? 0,
        boxId: t.tokenId,
        box: { transactionId: hex32(), additionalRegisters: t.registers ?? {} }
      }));
  }

  #mempoolLookup(txIds: string[]) {
    return this.#mempool
      .filter((tx) => txIds.includes(tx.transactionId))
      .map((tx) => ({ transactionId: tx.transactionId }));
  }

  #boxes(query: string, vars: Record<string, unknown>) {
    const spentInMempool = new Set(
      this.#mempool.flatMap((tx) => tx.inputs.map((i) => i.box.boxId))
    );
    const filter = (boxes: GqlBox[]) =>
      paginate(
        boxes
          .filter((b) => !vars.ergoTrees || (vars.ergoTrees as string[]).includes(b.ergoTree))
          .filter((b) => !vars.boxIds || (vars.boxIds as string[]).includes(b.boxId))
          .filter((b) => !vars.tokenId || b.assets.some((a) => a.tokenId === vars.tokenId))
          .map((b) => ({ ...b, beingSpent: spentInMempool.has(b.boxId) })),
        vars
      );

    const result: Record<string, unknown> = {};
    if (/boxes\(spent/.test(query)) result.boxes = filter(this.#unspent);
    if (/mempool\s*\{/.test(query)) {
      const created = this.#mempool.flatMap((tx) => tx.outputs);
      result.mempool = { boxes: filter(created) };
    }

    return result;
  }

  #transactions(source: GqlTransaction[], vars: Record<string, unknown>) {
    const addresses = vars.addresses as string[] | undefined;
    const txIds = vars.transactionIds as string[] | undefined;
    const trees = addresses ? new Set(addresses.map(treeOf)) : undefined;
    const relevantOnly = vars.onlyRelevantOutputs === true;

    const txs = source
      .filter((tx) => !txIds || txIds.includes(tx.transactionId))
      .filter(
        (tx) =>
          !trees ||
          tx.inputs.some((i) => trees.has(i.box.ergoTree)) ||
          tx.outputs.some((o) => trees.has(o.ergoTree))
      )
      .map((tx) =>
        relevantOnly && trees
          ? { ...tx, outputs: tx.outputs.filter((o) => trees.has(o.ergoTree)) }
          : tx
      )
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

    return paginate(txs, vars);
  }

  #check(tx: SignedTransaction) {
    if (this.submitError) throw new Error(this.submitError);

    const known = new Map(
      [...this.#unspent, ...this.#mempool.flatMap((t) => t.outputs)].map((b) => [b.boxId, b])
    );
    const missing = tx.inputs.find((i) => !known.has(i.boxId));
    if (missing) {
      throw new Error("Malformed transaction: Every input of the transaction should be in UTXO.");
    }

    return tx.id;
  }

  #submit(tx: SignedTransaction) {
    this.#check(tx);

    const known = new Map(
      [...this.#unspent, ...this.#mempool.flatMap((t) => t.outputs)].map((b) => [b.boxId, b])
    );

    this.submitted.push(tx);
    this.#mempool.push({
      transactionId: tx.id,
      timestamp: String(Date.now()),
      inputs: tx.inputs.map((input, index) => ({
        proofBytes: input.spendingProof?.proofBytes ?? "",
        extension: (input.spendingProof?.extension ?? {}) as Record<string, string>,
        index,
        box: known.get(input.boxId)!
      })),
      dataInputs: tx.dataInputs.map((d) => ({ boxId: d.boxId })),
      outputs: tx.outputs.map((o, index) => ({
        boxId: o.boxId,
        transactionId: tx.id,
        index,
        value: o.value.toString(),
        creationHeight: o.creationHeight,
        ergoTree: o.ergoTree,
        assets: o.assets.map((a) => ({ tokenId: a.tokenId, amount: a.amount.toString() })),
        additionalRegisters: o.additionalRegisters as Registers
      }))
    });

    return tx.id;
  }
}

function paginate<T>(items: T[], vars: Record<string, unknown>): T[] {
  const skip = (vars.skip as number) ?? 0;
  const take = (vars.take as number) ?? 50;
  return items.slice(skip, skip + take);
}
