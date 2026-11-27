import {
  EIP12UnsignedTransaction,
  first,
  SignedInput,
  SignedTransaction,
  some
} from "@fleet-sdk/common";
import { ErgoMessage } from "@fleet-sdk/core";
import { hex, randomBytes, utf8 } from "@fleet-sdk/crypto";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { hdKeyPool } from "@/common/objectPool";
import { hostOf } from "@/common/origin";
import { addressesDbService } from "@/database/addressesDbService";
import { walletsDbService } from "@/database/walletsDbService";
import { InputSigners } from "@/types/connector";
import { IDbAddress, IDbWallet } from "@/types/database";
import { getChangeAddress } from "./addresses";
import { extractAddressesFromInputs } from "./extraction";
import HdKey from "./hdKey";
import { graphQLService } from "./services/graphQlService";
import { hasV3ErgoTree } from "./transaction/blindSigning";
import { getPrivateDeriver, Prover, StateCallback } from "./transaction/prover";

export interface UnsignedAuthMessage {
  message: string;
  origin: string;
}

export interface AuthSignedMessage {
  signedMessage: string;
  proof: string;
}

export interface TransactionSigningParams {
  transaction: EIP12UnsignedTransaction;
  walletId?: number;
  /** Leave out to use the unlock session. */
  password?: string;
  stateCallback?: StateCallback;
  inputsToSign?: number[];
  signers?: InputSigners;
}

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

export async function signMessage(
  message: ErgoMessage,
  addresses: string[],
  walletId: number,
  password?: string
): Promise<string> {
  return hex.encode(
    new Prover(await getPrivateDeriver(walletId, password))
      .from(await addressesDbService.getByWalletIdAndScripts(walletId, addresses, "strict"))
      .signMessage(message.serialize().toBytes())
  );
}

export async function signAuthMessage(
  unsigned: UnsignedAuthMessage,
  addresses: string[],
  walletId: number,
  password?: string
): Promise<AuthSignedMessage> {
  const signedMessage = buildAuthMessage(unsigned.message, hostOf(unsigned.origin));
  const proof = new Prover(await getPrivateDeriver(walletId, password))
    .from(await addressesDbService.getByWalletIdAndScripts(walletId, addresses, "strict"))
    .signMessage(utf8.decode(signedMessage));

  return { signedMessage, proof: hex.encode(proof) };
}

export async function signTransaction({
  transaction,
  walletId: requestedWalletId,
  password,
  stateCallback: callback,
  inputsToSign,
  signers
}: TransactionSigningParams): Promise<SignedTransaction | SignedInput[]> {
  const wallet = useWalletStore();
  const app = useAppStore();
  const walletId = requestedWalletId ?? wallet.id;

  let storedWallet: IDbWallet | undefined;
  if (requestedWalletId !== undefined) {
    storedWallet = await walletsDbService.getById(walletId);
    if (!storedWallet) throw new Error(`Wallet 'id:${walletId}' not found.`);
  }

  const walletType = storedWallet?.type ?? wallet.type;
  const walletSettings = storedWallet?.settings ?? wallet.settings;
  const isLedger = walletType === "ledger";
  const inputAddresses = extractAddressesFromInputs(transaction.inputs);
  // With script reduction, a signer's key could also prove inputs the dApp didn't list.
  if (signers && (isLedger || hasV3ErgoTree(transaction))) {
    inputAddresses.push(...Object.values(signers).filter((a) => a !== null));
  }
  const ownAddresses = await addressesDbService.getByWalletId(walletId);
  const addresses = ownAddresses
    .filter((a) => inputAddresses.includes(a.script))
    .map((a) => dbAddressMapper(a));

  if (addresses.length === 0) {
    const change = (a: IDbAddress): boolean => a.index === walletSettings.defaultChangeIndex;
    const firstIndex = (a: IDbAddress): boolean => a.index === 0;

    addresses.push(
      dbAddressMapper(
        ownAddresses.find(change) ?? ownAddresses.find(firstIndex) ?? first(ownAddresses)
      )
    );
  }

  if (isLedger && some(inputsToSign)) {
    throw new Error("Signing selected inputs is not supported by Ledger devices.");
  }

  const deriver = isLedger
    ? getLedgerDeriver(storedWallet, wallet.publicKey)
    : await getPrivateDeriver(walletId, password);

  const encodedAddresses = ownAddresses.map((a) => a.script);
  const changeAddress = getChangeAddress(transaction.outputs, encodedAddresses);

  const blockHeaders = isLedger ? [] : await graphQLService.getHeaders({ take: 10 });
  const changeIndex = ownAddresses.find((a) => a.script === changeAddress)?.index ?? 0;
  const prover = new Prover(deriver)
    .from(addresses)
    .useLedger(isLedger)
    .withTransport(app.settings.ledger.transport)
    .changeIndex(changeIndex)
    .setHeaders(blockHeaders)
    .setSigners(signers)
    .setCallback(callback);

  if (some(inputsToSign)) return prover.signInputs(transaction, inputsToSign);

  const signed = await prover.signTransaction(transaction);
  if (hasV3ErgoTree(transaction)) {
    // v3 transactions are signed without script reduction, so a node is the only validity check.
    const result = await graphQLService.checkTransaction(signed);
    if (!result.success) throw new Error(result.message);
  }

  return signed;
}

function getLedgerDeriver(storedWallet: IDbWallet | undefined, publicKey: string): HdKey {
  if (!storedWallet) return hdKeyPool.get(publicKey);
  return HdKey.fromPublicKey({
    publicKey: storedWallet.publicKey,
    chainCode: storedWallet.chainCode
  });
}

function dbAddressMapper(a: IDbAddress) {
  return { ...a, balance: undefined };
}
