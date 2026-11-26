import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { SignedTransaction } from "@fleet-sdk/common";
import { ErgoAddress, ErgoBox, ErgoTree, FEE_CONTRACT } from "@fleet-sdk/core";
import { hex } from "@fleet-sdk/crypto";
import { Transaction } from "ergo-lib-wasm-browser";
import type { BrowserContext, Route, WebSocketRoute } from "@playwright/test";

/** Relays the wallet may talk to: the default one, and one tests can switch to in settings. */
export const RELAY_URLS = ["https://hergmes.nautiluswallet.com", "https://relay.test"];

/** Address used as the counterparty of funding transactions. */
export const EXTERNAL_ADDRESS = "9iPgSVU3yrRnTxtJC6hYA7bS5mMqZtjeJHrT3fNdLV7JZVpY5By";

type Asset = { tokenId: string; amount: string };
type Registers = Record<string, string>;

export type MockBox = {
  boxId: string;
  transactionId: string;
  index: number;
  value: string;
  creationHeight: number;
  ergoTree: string;
  assets: Asset[];
  additionalRegisters: Registers;
};

type MockInput = {
  proofBytes: string;
  extension: Record<string, string>;
  index: number;
  box: MockBox;
};

export type MockTransaction = {
  transactionId: string;
  timestamp: string;
  inputs: MockInput[];
  dataInputs: { boxId: string }[];
  outputs: MockBox[];
  inclusionHeight?: number;
  headerId?: string;
  index?: number;
};

/** An EIP-4 token, as the relay serves it; `type` and `artworkUrl` are hergmes' names. */
export type TokenMetadata = {
  tokenId: string;
  name: string;
  decimals?: number;
  description?: string;
  emissionAmount?: string;
  type?: string;
  artworkUrl?: string;
};

type BlockRef = { height: number; headerId: string };
/** A key the relay follows: an address, a token id, or a contract's template. */
type Key = { address: string } | { tokenId: string } | { template: string };
/**
 * A followed key: an address's balance alone, or the key's boxes, from the snapshot at
 * `lastChange`. Token and template keys always follow boxes.
 */
type Follow = { key: Key; lastChange?: BlockRef };

export type BoxOptions = {
  nanoErgs: bigint | string;
  tokens?: Asset[];
  creationHeight?: number;
  registers?: Registers;
};

const HEADERS: { id: string; height: number }[] = JSON.parse(
  readFileSync(new URL("../fixtures/data/headers.json", import.meta.url), "utf8")
).items;
const hex32 = () => randomBytes(32).toString("hex");
const treeOf = (address: string) => ErgoAddress.decode(address).ergoTree;

/** Keys followed sockets by; an address's is the address itself. */
const keyId = (key: Key) =>
  "address" in key
    ? key.address
    : "tokenId" in key
      ? `token:${key.tokenId}`
      : `template:${key.template}`;

function templateOf(ergoTree: string): string | undefined {
  try {
    const tree = new ErgoTree(ergoTree);
    return tree.hasSegregatedConstants ? hex.encode(tree.template) : undefined;
  } catch {
    return undefined;
  }
}

/** Whether `box` belongs to `key`. */
function matcher(key: Key): (box: MockBox) => boolean {
  if ("address" in key) {
    const tree = treeOf(key.address);
    return (box) => box.ergoTree === tree;
  }
  if ("tokenId" in key) return (box) => box.assets.some((a) => a.tokenId === key.tokenId);
  return (box) => templateOf(box.ergoTree) === key.template;
}

/**
 * In-memory Ergo blockchain served through the hergmes relay's REST API and WebSocket (tips,
 * balance subscriptions to addresses, and box subscriptions to addresses, tokens and templates).
 * Tests mutate its state (fund addresses, add tokens, push mempool transactions, ...) and the
 * wallet reads it through intercepted HTTP requests.
 */
export class MockChain {
  height = HEADERS[0].height;
  network = "mainnet";
  /** Whether the relay reports it has started. */
  ready = true;
  relayVersion = "0.3.0";
  minValuePerByte = 360;

  /** When set, `submitTransaction` and `checkTransaction` fail with this message. */
  submitError?: string;

  /**
   * How long a submitted tx stays unseen by the relay's routes, as the relay only applies it
   * at its next mempool poll. The node still knows it, so txs chained on it are taken.
   */
  relayLagMs = 0;

  /** When set, box snapshots fail with this relay error code, as `too_many_boxes` does. */
  boxesError?: string;
  /** With `boxesError`, answers `429` with this `Retry-After`, so the app waits to try again. */
  boxesRetryAfter?: number;

  /** When set, address histories fail with this relay error code, not retried by the client. */
  historyError?: string;

  /** Every signed transaction successfully submitted to the chain. */
  readonly submitted: SignedTransaction[] = [];

  /**
   * Log of every relay route (`GET /v1/...`) and socket message (`WS subscribe`,
   * `WS unsubscribe`) received.
   */
  readonly operations: { name: string; variables: Record<string, unknown> }[] = [];

  /** Open relay sockets and the keys each follows, by `keyId`. */
  #sockets = new Map<WebSocketRoute, Map<string, Follow>>();
  /**
   * Stands for the block of the last confirmed change. Confirmed boxes change without blocks
   * here, so a box subscriber is asked to read a new snapshot whenever they do.
   */
  #changeId = hex32();
  #socketsDown = false;

  #unspent: MockBox[] = [];
  #confirmed: MockTransaction[] = [];
  #mempool: MockTransaction[] = [];
  #unseen: MockTransaction[] = [];
  #tokens = new Map<string, TokenMetadata>();
  #used = new Set<string>();

  /**
   * Creates a confirmed transaction sending the given assets from an external address
   * to `address`. Returns the created box.
   */
  fund(address: string, opt: BoxOptions): MockBox {
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
    this.#pushChanges(true);

    return output;
  }

  /** Adds an arbitrary unspent box, e.g. a contract box snapshotted from mainnet. */
  addBox(box: MockBox) {
    this.#unspent.push(box);
    this.#pushChanges(true);
  }

  /**
   * Adds a pending tx paying each of `outputs`, and a fee, funded by an external address and
   * by the ERG of the boxes in `spend`, as a dApp tx spending a wallet's box does.
   */
  receivePending(
    outputs: [address: string, opt: BoxOptions][],
    spend: MockBox[] = []
  ): MockTransaction {
    const transactionId = hex32();
    const fee = 1_100_000n;
    const total = outputs.reduce((sum, [, opt]) => sum + BigInt(opt.nanoErgs), fee);
    const spent = spend.reduce((sum, box) => sum + BigInt(box.value), 0n);
    const input = this.#createBox(
      treeOf(EXTERNAL_ADDRESS),
      { nanoErgs: total - spent, tokens: outputs.flatMap(([, opt]) => opt.tokens ?? []) },
      hex32(),
      0,
      this.height - 100
    );
    const tx: MockTransaction = {
      transactionId,
      timestamp: String(Date.now()),
      inputs: [input, ...spend].map((box, index) => ({
        proofBytes: "",
        extension: {},
        index,
        box
      })),
      dataInputs: [],
      outputs: [
        ...outputs.map(([address, opt], i) =>
          this.#createBox(treeOf(address), opt, transactionId, i, this.height)
        ),
        this.#createBox(FEE_CONTRACT, { nanoErgs: fee }, transactionId, outputs.length, this.height)
      ]
    };

    this.#unspent.push(input);
    this.addPending(tx);
    return tx;
  }

  /** Adds a tx sent by someone else to the mempool, e.g. a contract update. */
  addPending(tx: MockTransaction) {
    this.#mempool.push(tx);
    this.#pushChanges();
  }

  /** Advances the chain height. */
  mine(blocks = 1) {
    this.height += blocks;
    for (const ws of this.#sockets.keys()) this.#sendTip(ws);
    this.#pushChanges();
  }

  /** Registers token metadata, as served by the relay. */
  addToken(token: TokenMetadata) {
    this.#tokens.set(token.tokenId, token);
  }

  /** Marks an address as used even if it holds no boxes. */
  markUsed(address: string) {
    this.#used.add(address);
  }

  /** Unspent confirmed boxes owned by `address`. */
  boxesOf(address: string): MockBox[] {
    const tree = treeOf(address);
    return this.#unspent.filter((b) => b.ergoTree === tree);
  }

  get mempool(): readonly MockTransaction[] {
    return this.#mempool;
  }

  /** Whether an open relay socket follows `address`. */
  follows(address: string) {
    return [...this.#sockets.values()].some((keys) => keys.has(address));
  }

  /** Whether an open relay socket follows the boxes of `address`, not only its balance. */
  followsBoxes(address: string) {
    return [...this.#sockets.values()].some((keys) => !!keys.get(address)?.lastChange);
  }

  /** Closes every relay socket and, while `down`, every socket the app opens again. */
  setSocketsDown(down: boolean) {
    this.#socketsDown = down;
    if (down) for (const ws of this.#sockets.keys()) ws.close();
  }

  /** Count of operations received with the given name. */
  count(operationName: string) {
    return this.operations.filter((x) => x.name === operationName).length;
  }

  async install(context: BrowserContext) {
    for (const url of RELAY_URLS) {
      await context.route(`${url}/v1/**`, (route) => this.#handleRelay(route));
      await context.routeWebSocket(`${url.replace(/^http/, "ws")}/v1/ws`, (ws) =>
        this.#handleSocket(ws)
      );
    }
  }

  #handleSocket(ws: WebSocketRoute) {
    if (this.#socketsDown) return ws.close();
    const keys = new Map<string, Follow>();
    this.#sockets.set(ws, keys);
    ws.onClose(() => this.#sockets.delete(ws));
    this.#sendTip(ws, true);

    ws.onMessage((data) => {
      const message = JSON.parse(String(data));
      const { id } = message;
      const key = message.key as Key;
      this.operations.push({ name: `WS ${message.op}`, variables: message });

      if (message.op === "unsubscribe") {
        keys.delete(keyId(key));
      } else if (message.op === "subscribe") {
        const from: BlockRef | undefined = message.from;
        if (from && from.headerId !== this.#changeId) {
          ws.send(JSON.stringify({ type: "resync_required", id, key, reason: "outside_window" }));
          return;
        }

        const follow = { key, lastChange: from };
        keys.set(keyId(key), follow);
        ws.send(JSON.stringify({ type: "subscribed", id, key }));
        this.#sendState(ws, follow);
      }
    });
  }

  #sendTip(ws: WebSocketRoute, withParameters = false) {
    const tip = { type: "tip", height: this.height, headerId: HEADERS[0].id };
    const parameters = { height: this.height, minValuePerByte: this.minValuePerByte };
    ws.send(JSON.stringify(withParameters ? { ...tip, parameters } : tip));
  }

  /** The mempool's effect on a followed key's boxes, if it follows them, and an address's balance. */
  #sendState(ws: WebSocketRoute, { key, lastChange }: Follow) {
    if (lastChange) {
      ws.send(JSON.stringify({ type: "mempool", key, lastChange, pending: this.#pendingOf(key) }));
    }
    if (!("address" in key)) return;

    const { confirmed, pending } = this.#balance(key.address);
    const asOf = { height: this.height, headerId: HEADERS[0].id };
    ws.send(JSON.stringify({ type: "balance", key, asOf, lastChange, confirmed, pending }));
  }

  /**
   * Sends every followed address its state, as the relay does when a block or tx moves it. A
   * confirmed change asks box subscribers for a new snapshot instead.
   */
  #pushChanges(confirmed = false) {
    if (confirmed) this.#changeId = hex32();

    for (const [ws, keys] of this.#sockets) {
      for (const follow of keys.values()) {
        if (confirmed && follow.lastChange) {
          const message = { type: "resync_required", key: follow.key, reason: "outside_window" };
          ws.send(JSON.stringify(message));
        } else {
          this.#sendState(ws, follow);
        }
      }
    }
  }

  async #handleRelay(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const name = `${request.method()} ${url.pathname}`;
    this.operations.push({ name, variables: Object.fromEntries(url.searchParams) });

    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, json: body, headers: { "access-control-allow-origin": "*" } });

    if (request.method() === "POST" && url.pathname === "/v1/transactions") {
      try {
        // rejected before parsing, so tests can send txs a node couldn't read
        if (this.submitError) throw new Error(this.submitError);
        const tx = parseTransaction(request.postData() ?? "");
        const transactionId =
          url.searchParams.get("broadcast") === "false" ? this.#check(tx) : this.#submit(tx);
        return json({ transactionId });
      } catch (e) {
        const message = (e as Error).message;
        return json({ error: "transaction_rejected", reason: "invalid", message }, 400);
      }
    }

    const spendable = url.pathname.match(/^\/v1\/addresses\/([^/]+)\/boxes\/spendable$/);
    if (request.method() === "GET" && spendable) {
      const items = this.#spendable(decodeURIComponent(spendable[1]));
      return json({ asOf: { height: this.height }, items, truncated: false, total: items.length });
    }

    const boxes = url.pathname.match(/^\/v1\/(addresses|tokens|templates)\/([^/]+)\/boxes$/);
    if (request.method() === "GET" && boxes) {
      if (this.boxesError) {
        const body = { error: this.boxesError, message: this.boxesError };
        if (this.boxesRetryAfter === undefined) return json(body, 422);
        return route.fulfill({
          status: 429,
          json: body,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-expose-headers": "retry-after",
            "retry-after": String(this.boxesRetryAfter)
          }
        });
      }
      const limit = Number(url.searchParams.get("limit") ?? 100);
      const value = decodeURIComponent(boxes[2]);
      const key: Key =
        boxes[1] === "addresses"
          ? { address: value }
          : boxes[1] === "tokens"
            ? { tokenId: value }
            : { template: value };
      const items = this.#unspent
        .filter(matcher(key))
        .map((b) => ({ ...b, inclusionHeight: b.creationHeight }))
        .sort((a, b) => a.inclusionHeight - b.inclusionHeight);
      const asOf = { height: this.height, headerId: this.#changeId };
      return json({ asOf, items: items.slice(0, limit), nextCursor: null });
    }

    const balance = url.pathname.match(/^\/v1\/addresses\/([^/]+)\/balance$/);
    if (request.method() === "GET" && balance) {
      return json({
        asOf: { height: this.height },
        ...this.#balance(decodeURIComponent(balance[1]))
      });
    }

    const pooled = url.pathname.match(/^\/v1\/mempool\/transactions\/([^/]+)$/);
    if (request.method() === "GET" && pooled) {
      const tx = this.#mempool.find((t) => t.transactionId === pooled[1]);
      if (!tx) return json({ error: "transaction_not_found", message: "no pending tx" }, 404);

      return json({
        id: tx.transactionId,
        inputs: tx.inputs.map((i) => ({
          ...i.box,
          spendingProof: { proofBytes: i.proofBytes, extension: i.extension }
        })),
        dataInputs: tx.dataInputs,
        outputs: tx.outputs
      });
    }

    const history = url.pathname.match(/^\/v1\/addresses\/([^/]+)\/transactions$/);
    if (request.method() === "GET" && history) {
      if (this.historyError) {
        return json({ error: this.historyError, message: this.historyError }, 422);
      }
      const limit = Number(url.searchParams.get("limit") ?? 25);
      const offset = Number(url.searchParams.get("cursor") ?? 0);
      const items = this.#history(decodeURIComponent(history[1]));
      const end = offset + limit >= items.length;
      return json({
        items: items.slice(offset, offset + limit),
        nextCursor: end ? null : String(offset + limit)
      });
    }

    switch (name) {
      case "GET /v1/status":
        return json({
          version: this.relayVersion,
          network: this.network,
          tip: { height: this.height, headerId: HEADERS[0].id },
          ready: this.ready
        });
      case "GET /v1/parameters":
        return json({ height: this.height, minValuePerByte: this.minValuePerByte });
      case "GET /v1/headers": {
        const limit = Number(url.searchParams.get("limit") ?? 10);
        const asOf = { height: HEADERS[0].height, headerId: HEADERS[0].id };
        return json({ asOf, items: HEADERS.slice(0, limit) });
      }
      case "GET /v1/tokens/metadata": {
        const ids = (url.searchParams.get("ids") ?? "").split(",");
        return json({ items: this.#tokenInfo(ids) });
      }
      default:
        return json({ error: "not_found", message: `MockChain: unsupported route '${name}'` }, 404);
    }
  }

  #createBox(
    ergoTree: string,
    opt: BoxOptions,
    transactionId: string,
    index: number,
    creationHeight: number
  ): MockBox {
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

  #tokenInfo(tokenIds: string[]) {
    return tokenIds
      .map((id) => this.#tokens.get(id))
      .filter((t): t is TokenMetadata => !!t)
      .map((t) => ({
        tokenId: t.tokenId,
        mintingTxId: hex32(),
        emission: t.emissionAmount ?? "1000000",
        standard: "eip-4",
        metadata: {
          name: t.name,
          description: t.description ?? "",
          decimals: t.decimals ?? 0,
          ...(t.type ? { type: t.type } : {}),
          ...(t.artworkUrl ? { artworkUrl: t.artworkUrl } : {})
        }
      }));
  }

  /** Assets of `address` at the tip, and the signed change mempool txs make to them. */
  #balance(address: string) {
    const tree = treeOf(address);
    const created = this.#mempool.flatMap((tx) => tx.outputs);
    const spentIds = new Set(this.#mempool.flatMap((tx) => tx.inputs.map((i) => i.box.boxId)));
    const spent = [...this.#unspent, ...created].filter((b) => spentIds.has(b.boxId));
    const own = (boxes: MockBox[]) => boxes.filter((b) => b.ergoTree === tree);

    const confirmed = sumAssets(own(this.#unspent));
    const pending = sumAssets(own(created), own(spent));
    const used = this.#used.has(address) || own(this.#unspent).length > 0;

    return { confirmed, pending, used };
  }

  /** The txs touching `address`, pending first, each with its signed change to it. */
  #history(address: string) {
    const tree = treeOf(address);
    const own = (boxes: MockBox[]) => boxes.filter((b) => b.ergoTree === tree);
    const confirmed = [...this.#confirmed].sort(
      (a, b) => (b.inclusionHeight ?? 0) - (a.inclusionHeight ?? 0)
    );

    return [...[...this.#mempool].reverse(), ...confirmed]
      .map((tx) => ({
        tx,
        outputs: own(tx.outputs),
        inputs: own(tx.inputs.map((i) => i.box))
      }))
      .filter(({ outputs, inputs }) => outputs.length > 0 || inputs.length > 0)
      .map(({ tx, outputs, inputs }) => ({
        txId: tx.transactionId,
        height: tx.inclusionHeight,
        timestamp: tx.inclusionHeight === undefined ? undefined : Number(tx.timestamp),
        delta: sumAssets(outputs, inputs),
        fee: tx.outputs.find((o) => o.ergoTree === FEE_CONTRACT)?.value
      }));
  }

  /** The mempool txs touching `key`: their outputs to it, and its boxes they spend. */
  #pendingOf(key: Key) {
    const matches = matcher(key);
    return this.#mempool
      .map((tx) => ({
        txId: tx.transactionId,
        created: tx.outputs.filter(matches),
        spent: tx.inputs.filter((i) => matches(i.box)).map((i) => i.box.boxId)
      }))
      .filter((tx) => tx.created.length > 0 || tx.spent.length > 0);
  }

  /** Confirmed boxes and mempool outputs of `address`, less what mempool txs spend. */
  #spendable(address: string) {
    const tree = treeOf(address);
    const spent = new Set(this.#mempool.flatMap((tx) => tx.inputs.map((i) => i.box.boxId)));
    const confirmed = this.#unspent
      .filter((b) => b.ergoTree === tree && !spent.has(b.boxId))
      .map((b) => ({ ...b, inclusionHeight: b.creationHeight }));
    const pending = this.#mempool
      .flatMap((tx) => tx.outputs)
      .filter((b) => b.ergoTree === tree && !spent.has(b.boxId));

    return [...confirmed, ...pending];
  }

  #check(tx: SignedTransaction) {
    if (this.submitError) throw new Error(this.submitError);

    const known = new Map(this.#nodeBoxes().map((b) => [b.boxId, b]));
    const missing = tx.inputs.find((i) => !known.has(i.boxId));
    if (missing) {
      throw new Error("Malformed transaction: Every input of the transaction should be in UTXO.");
    }
    if (tx.dataInputs.some((d) => !known.has(d.boxId))) {
      throw new Error("Malformed transaction: Missed data boxes.");
    }

    return tx.id;
  }

  /** Boxes the node can resolve inputs against: confirmed, and outputs of every pool tx. */
  #nodeBoxes() {
    return [...this.#unspent, ...[...this.#mempool, ...this.#unseen].flatMap((t) => t.outputs)];
  }

  #submit(tx: SignedTransaction) {
    this.#check(tx);

    const known = new Map(this.#nodeBoxes().map((b) => [b.boxId, b]));

    this.submitted.push(tx);
    const pooled: MockTransaction = {
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
    };

    if (this.relayLagMs > 0) {
      this.#unseen.push(pooled);
      setTimeout(() => {
        this.#unseen = this.#unseen.filter((t) => t !== pooled);
        this.#mempool.push(pooled);
        this.#pushChanges();
      }, this.relayLagMs);
    } else {
      this.#mempool.push(pooled);
      this.#pushChanges();
    }

    return tx.id;
  }
}

/**
 * A signed tx from the hex the relay takes. ergo-lib rather than Fleet's deserializer, which
 * can't read ErgoTrees without a size flag, like the SigmaUSD and Babel Fee contracts'.
 */
function parseTransaction(body: string): SignedTransaction {
  const tx = Transaction.sigma_parse_bytes(hex.decode(body.trim()));
  try {
    return tx.to_js_eip12() as SignedTransaction;
  } finally {
    tx.free();
  }
}

/** What `added` holds less what `removed` holds, in the relay's wire shape. */
function sumAssets(added: MockBox[], removed: MockBox[] = []) {
  let nanoErgs = 0n;
  const tokens = new Map<string, bigint>();
  for (const [boxes, sign] of [
    [added, 1n],
    [removed, -1n]
  ] as const) {
    for (const box of boxes) {
      nanoErgs += sign * BigInt(box.value);
      for (const t of box.assets) {
        tokens.set(t.tokenId, (tokens.get(t.tokenId) ?? 0n) + sign * BigInt(t.amount));
      }
    }
  }

  return {
    nanoErgs: nanoErgs.toString(),
    tokens: [...tokens]
      .filter(([, amount]) => amount !== 0n)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tokenId, amount]) => ({ tokenId, amount: amount.toString() }))
  };
}
