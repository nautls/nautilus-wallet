import {
  EIP12UnsignedTransaction,
  first,
  SignedInput,
  SignedTransaction,
  some
} from "@fleet-sdk/common";
import { ErgoMessage } from "@fleet-sdk/core";
import { hex, randomBytes, utf8 } from "@fleet-sdk/crypto";
import { useWalletStore } from "@/stores/walletStore";
import { hdKeyPool } from "@/common/objectPool";
import { addressesDbService } from "@/database/addressesDbService";
import { walletsDbService } from "@/database/walletsDbService";
import { IDbAddress } from "@/types/database";
import { SigningState, WalletType } from "@/types/internal";
import { getChangeAddress } from "./addresses";
import { extractAddressesFromInputs } from "./extraction";
import HdKey from "./hdKey";
import { graphQLService } from "./services/graphQlService";
import { getPrivateDeriver, Prover } from "./transaction/prover";

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
  password: string;
  stateCallback?: SignStateReportCallback;
  stateRetrieval?: SignStateRetrieval;
  inputsToSign?: number[];
}

const wallet = useWalletStore();

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
  password: string
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
  password: string
): Promise<AuthSignedMessage> {
  const signedMessage = buildAuthMessage(unsigned.message, unsigned.origin);
  const proof = new Prover(await getPrivateDeriver(walletId, password))
    .from(await addressesDbService.getByWalletIdAndScripts(walletId, addresses, "strict"))
    .signMessage(utf8.decode(signedMessage));

  return { signedMessage, proof: hex.encode(proof) };
}

type SignStateReportCallback = (newState: Partial<SigningState>) => void;
type SignStateRetrieval = () => Partial<SigningState>;

export async function signTransaction({
  transaction,
  password,
  stateCallback: callback,
  stateRetrieval: retrieval,
  inputsToSign
}: TransactionSigningParams): Promise<SignedTransaction | SignedInput[]> {
  const walletId = wallet.id;
  const inputAddresses = extractAddressesFromInputs(transaction.inputs);
  const ownAddresses = await addressesDbService.getByWalletId(walletId);
  const addresses = ownAddresses
    .filter((a) => inputAddresses.includes(a.script))
    .map((a) => dbAddressMapper(a));

  if (addresses.length === 0) {
    const change = (a: IDbAddress): boolean => a.index === wallet.settings.defaultChangeIndex;
    const firstIndex = (a: IDbAddress): boolean => a.index === 0;

    addresses.push(
      dbAddressMapper(
        ownAddresses.find(change) ?? ownAddresses.find(firstIndex) ?? first(ownAddresses)
      )
    );
  }

  if (callback) callback({ statusText: "Loading context..." });

  const isLedger = wallet.type === WalletType.Ledger;
  const isKeystone = wallet.type === WalletType.Keystone;
  const deriver =
    isLedger || isKeystone
      ? hdKeyPool.get(wallet.publicKey)
      : await HdKey.fromMnemonic(await walletsDbService.getMnemonic(walletId, password));

  const encodedAddresses = ownAddresses.map((a) => a.script);
  const changeAddress = getChangeAddress(transaction.outputs, encodedAddresses);

  const blockHeaders = isLedger ? [] : await graphQLService.getHeaders({ take: 10 });
  const changeIndex = ownAddresses.find((a) => a.script === changeAddress)?.index ?? 0;
  const prover = new Prover(deriver)
    .from(addresses)
    .useLedger(isLedger)
    .useKeystone(isKeystone)
    .changeIndex(changeIndex)
    .setHeaders(blockHeaders)
    .setCallback(callback)
    .setRetrieval(retrieval);

  return some(inputsToSign)
    ? prover.signInputs(transaction, inputsToSign)
    : prover.signTransaction(transaction);
}

function dbAddressMapper(a: IDbAddress) {
  return { ...a, balance: undefined };
}
