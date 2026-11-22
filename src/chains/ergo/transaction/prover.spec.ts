import { EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import { ErgoAddress } from "@fleet-sdk/core";
import { blake2b256, hex } from "@fleet-sdk/crypto";
import { serializeBox } from "@fleet-sdk/serializer";
import { ErgoHDKey, Prover as FleetProver } from "@fleet-sdk/wallet";
import { describe, expect, it, vi } from "vitest";
import { DERIVATION_PATH } from "@/constants/ergo";
import HdKey from "../hdKey";
import { Prover } from "./prover";

vi.mock("@/database/walletsDbService", () => ({ walletsDbService: {} }));
vi.mock("@/common/ledger", () => ({ createTransport: vi.fn() }));

const ledgerSignTx = vi.hoisted(() => vi.fn());
vi.mock("ledger-ergo-js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ledger-ergo-js")>()),
  ErgoLedgerApp: class {
    authToken = 1;
    useAuthToken = () => this;
    signTx = ledgerSignTx;
  }
}));

const MNEMONIC =
  "decline usual reward fine flight vintage deny slight minimum spirit hero aerobic loan peanut feel";

async function setup() {
  const deriver = await HdKey.fromMnemonic(MNEMONIC);
  const [addr0, addr1] = deriver.deriveAddresses(2);
  const key0 = deriver.deriveKey(0);
  const key1 = deriver.deriveKey(1);
  const pk1 = hex.encode(key1.publicKey);

  const box = (n: number, ergoTree: string) => ({
    boxId: n.toString().repeat(64),
    transactionId: "e".repeat(64),
    index: 0,
    value: "1000000000",
    ergoTree,
    creationHeight: 1_000_000,
    assets: [],
    additionalRegisters: {},
    extension: {}
  });

  const p2pk0 = ErgoAddress.decode(addr0.script).ergoTree;
  const tx: EIP12UnsignedTransaction = {
    inputs: [
      box(1, p2pk0), // own P2PK
      box(2, "1b0401d1930000"), // v3 contract with no keys
      box(3, `1b260108cd${pk1}7300`) // v3 contract holding key 1
    ],
    dataInputs: [],
    outputs: [
      {
        value: "2999000000",
        ergoTree: p2pk0,
        creationHeight: 1_000_001,
        assets: [],
        additionalRegisters: {}
      }
    ]
  };

  const prover = new Prover(deriver).from([addr0, addr1]);
  return { prover, tx, addr0, addr1, key0, key1 };
}

const verify = (signed: SignedTransaction, proof: string | undefined, key: ErgoHDKey) =>
  new FleetProver().verify(signed, proof ?? "", key);

describe("Prover with ErgoTree v3", () => {
  it("signs own and key-holding inputs and leaves the rest empty", async () => {
    const { prover, tx, key0, key1 } = await setup();
    const signed = await prover.signTransaction(tx);
    const [p2pk, noKeys, withKey] = signed.inputs.map((i) => i.spendingProof?.proofBytes);

    expect(verify(signed, p2pk, key0)).toBe(true);
    expect(noKeys).toBe("");
    expect(verify(signed, withKey, key1)).toBe(true);
  });

  it("uses the signers given by the dApp over extracted keys", async () => {
    const { prover, tx, addr0, key0 } = await setup();
    const signed = await prover.setSigners({ 1: addr0.script, 2: null }).signTransaction(tx);
    const [, noKeys, withKey] = signed.inputs.map((i) => i.spendingProof?.proofBytes);

    expect(verify(signed, noKeys, key0)).toBe(true);
    expect(withKey).toBe("");
  });

  it("throws when a signer isn't one of the prover's addresses", async () => {
    const { tx } = await setup();
    const deriver = await HdKey.fromMnemonic(MNEMONIC);
    const [addr0, , addr2] = deriver.deriveAddresses(3);
    const prover = new Prover(deriver).from([addr0]).setSigners({ 1: addr2.script });

    await expect(prover.signTransaction(tx)).rejects.toThrow(`No key found for ${addr2.script}.`);
  });

  it("leaves inputs that only hold a key as data unsigned", async () => {
    const { prover, tx, addr1 } = await setup();
    const [pk1] = ErgoAddress.decode(addr1.script).getPublicKeys();
    tx.inputs[1].additionalRegisters = { R4: `08cd${hex.encode(pk1)}` };
    const signed = await prover.signTransaction(tx);

    expect(signed.inputs[1].spendingProof?.proofBytes).toBe("");
  });

  it("refuses Ledger signing and partial signing", async () => {
    const { prover, tx } = await setup();

    await expect(prover.signInputs(tx, [0])).rejects.toThrow("ErgoTree v3");
    await expect(prover.useLedger().signTransaction(tx)).rejects.toThrow("ErgoTree v3");
  });
});

describe("Prover with Ledger", () => {
  async function ledgerSetup() {
    const deriver = await HdKey.fromMnemonic(MNEMONIC);
    const [addr0, addr1] = deriver.deriveAddresses(2);
    const p2pk0 = ErgoAddress.decode(addr0.script).ergoTree;

    const box = (n: number) => {
      const b = {
        boxId: "",
        transactionId: n.toString().repeat(64),
        index: 0,
        value: "1000000000",
        ergoTree: p2pk0,
        creationHeight: 1_000_000,
        assets: [],
        additionalRegisters: {}
      };
      b.boxId = hex.encode(blake2b256(serializeBox(b).toBytes()));
      return { ...b, extension: {} };
    };

    const tx: EIP12UnsignedTransaction = {
      inputs: [box(1), box(2)],
      dataInputs: [],
      outputs: [
        {
          value: "1999000000",
          ergoTree: p2pk0,
          creationHeight: 1_000_001,
          assets: [],
          additionalRegisters: {}
        }
      ]
    };

    ledgerSignTx.mockReset().mockResolvedValue(tx.inputs.map(() => new Uint8Array(0)));
    const prover = new Prover(deriver).from([addr0, addr1]).useLedger().withTransport("webhid");
    return { prover, tx, addr1 };
  }

  const signPaths = () =>
    ledgerSignTx.mock.calls[0][0].inputs.map((i: { signPath: string }) => i.signPath);

  it("signs each input with the path of its address", async () => {
    const { prover, tx } = await ledgerSetup();
    await prover.signTransaction(tx);

    expect(signPaths()).toEqual([`${DERIVATION_PATH}/0`, `${DERIVATION_PATH}/0`]);
  });

  it("uses the signers given by the dApp", async () => {
    const { prover, tx, addr1 } = await ledgerSetup();
    await prover.setSigners({ 1: addr1.script }).signTransaction(tx);

    expect(signPaths()).toEqual([`${DERIVATION_PATH}/0`, `${DERIVATION_PATH}/1`]);
  });

  it("signs inputs marked as needing no proof with the change key", async () => {
    const { prover, tx, addr1 } = await ledgerSetup();
    await prover.changeIndex(2).setSigners({ 0: null, 1: addr1.script }).signTransaction(tx);

    expect(signPaths()).toEqual([`${DERIVATION_PATH}/2`, `${DERIVATION_PATH}/1`]);
  });
});
