import { Address, Asset, Box, Info, State, Token } from "@ergo-graphql/types";
import {
  createGqlOperation,
  ErgoGraphQLProvider,
  TransactionEvaluationResult,
  TransactionEvaluationSuccess
} from "@fleet-sdk/blockchain-providers";
import { chunk, isEmpty, SignedTransaction, some } from "@fleet-sdk/common";
import { hex, utf8 } from "@fleet-sdk/crypto";
import { SConstant } from "@fleet-sdk/serializer";
import { storage } from "webextension-polyfill";
import { safeSigmaDecode } from "@/chains/ergo/serialization";
import { bn } from "@/common/bigNumber";
import { log } from "@/common/logger";
import { ERG_TOKEN_ID, MAINNET } from "@/constants/ergo";
import { utxosDbService } from "@/database/utxosDbService";
import { Registers } from "@/types/connector";
import { IAssetInfo } from "@/types/database";
import { AssetStandard, AssetSubtype, AssetType } from "@/types/internal";

type AssetInfo = {
  tokenId: string;
  confirmedAmount: string;
  unconfirmedAmount?: string;
};

export type AddressInfo = {
  used: boolean;
  address: string;
  assets: AssetInfo[];
};

export type UnspentBoxesInfo = {
  oldest: number | undefined;
  count: number;
};

export const MIN_SERVER_VERSION = [0, 4, 4];
const MAX_PARAMS_PER_REQUEST = 20;

const FALLBACK_GRAPHQL_SERVERS = MAINNET
  ? ["https://gql.ergoplatform.com/", "https://graphql.erg.zelcore.io/"]
  : [];

export const DEFAULT_SERVER_URL = MAINNET
  ? "https://explore.sigmaspace.io/api/graphql"
  : "https://gql-testnet.ergoplatform.com/";

const checkServerInfo = createGqlOperation<{ info: Info; state: State }>(
  "query info { info { version } state { network } }"
);

export async function getServerInfo(url: string): Promise<{ network: string; version: string }> {
  const response = await checkServerInfo(undefined, url);
  if (!response.data) throw new Error(`No data returned from ${url}.`);

  return {
    network: response.data.state.network,
    version: response.data.info.version
  };
}

export async function validateServerVersion(url: string): Promise<boolean> {
  try {
    const response = await getServerInfo(url);
    const [major, minor] = response.version.split(".");

    return (
      Number.parseInt(major, 10) === MIN_SERVER_VERSION[0] &&
      Number.parseInt(minor, 10) >= MIN_SERVER_VERSION[1]
    );
  } catch {
    return false;
  }
}

export async function validateServerNetwork(url: string): Promise<boolean> {
  try {
    const response = await getServerInfo(url);

    return MAINNET ? response.network === "mainnet" : response.network === "testnet";
  } catch {
    return false;
  }
}

const ADDRESS_INFO_QUERY = `query addresses($addresses: [String!]!) { addresses(addresses: $addresses) { address used balance { nanoErgs assets { amount tokenId } } } }`;
const CURRENT_HEIGHT_QUERY = `query currentHeight { blockHeaders(take: 1) { height } }`;
const CHAIN_PARAMS_QUERY = `query chainParams { state { params { minValuePerByte } } }`;
const OLD_BOXES_CHECK_QUERY = `query oldBoxesCheck($maxHeight: Int, $addresses: [String!]) { boxes( maxHeight: $maxHeight addresses: $addresses heightType: creation spent: false take: 1 ) { creationHeight } }`;
const TOKEN_METADATA_QUERY = `query Tokens($tokenIds: [String!]) { tokens(tokenIds: $tokenIds) { tokenId type emissionAmount name description decimals boxId box { transactionId additionalRegisters } } }`;
const MEMPOOL_TXS_QUERY = `query mempoolTxCheck($transactionIds: [String!]) { mempool { transactions(transactionIds: $transactionIds) { transactionId } } }`;
const UNSPENT_BOXES_BY_TOKEN_QUERY = `query unspentBoxesByToken($tokenId: String, $take: Int) { boxes(tokenId: $tokenId, spent: false, take: $take) { boxId ergoTree creationHeight additionalRegisters assets { tokenId amount } } }`;
const SPENDING_TX_INPUTS_QUERY = `query spendingTransactionInputs($boxId: String) { inputs(boxId: $boxId, take: 5) { mainChain transaction { inputs { box { ergoTree assets { tokenId amount } } } } } }`;

type AddressInfoResponse = { addresses: Address[] };
type CurrentHeightResponse = { blockHeaders: { height: number }[] };
type ChainParamsResponse = { state: { params?: { minValuePerByte?: number } } };
type OldBoxesCheckResponse = { boxes: { creationHeight: number }[] };
type TokensResponse = { tokens: Token[] };
type MempoolTransactionsResponse = { mempool: { transactions: { transactionId: string }[] } };
type UnspentBoxesByTokenResponse = { boxes: UnspentTokenBox[] };
type SpendingTransactionInputsResponse = {
  inputs: { mainChain: boolean; transaction: { inputs: { box?: InputBox | null }[] } }[];
};

export type UnspentTokenBox = Pick<
  Box,
  "boxId" | "ergoTree" | "creationHeight" | "additionalRegisters"
> & { assets: Pick<Asset, "tokenId" | "amount">[] };

export type InputBox = Pick<Box, "ergoTree"> & { assets: Pick<Asset, "tokenId" | "amount">[] };

class GraphQLService extends ErgoGraphQLProvider<string> {
  #getAddressInfo;
  #getCurrentHeight;
  #getChainParams;
  #checkOldBoxes;
  #getTokenMetadata;
  #checkMempoolTxs;
  #getUnspentBoxesByToken;
  #getSpendingTransactionInputs;

  constructor() {
    super({
      url: DEFAULT_SERVER_URL,
      retry: { attempts: 5, delay: 500, fallbacks: FALLBACK_GRAPHQL_SERVERS }
    });

    this.setBigIntMapper((value) => value);
    this.#loadServerUrl();

    this.#getAddressInfo = this.createOperation<AddressInfoResponse>(ADDRESS_INFO_QUERY);
    this.#getCurrentHeight = this.createOperation<CurrentHeightResponse>(CURRENT_HEIGHT_QUERY);
    this.#getChainParams = this.createOperation<ChainParamsResponse>(CHAIN_PARAMS_QUERY);
    this.#checkOldBoxes = this.createOperation<OldBoxesCheckResponse>(OLD_BOXES_CHECK_QUERY);
    this.#getTokenMetadata = this.createOperation<TokensResponse>(TOKEN_METADATA_QUERY);
    this.#checkMempoolTxs = this.createOperation<MempoolTransactionsResponse>(MEMPOOL_TXS_QUERY);
    this.#getUnspentBoxesByToken = this.createOperation<UnspentBoxesByTokenResponse>(
      UNSPENT_BOXES_BY_TOKEN_QUERY
    );
    this.#getSpendingTransactionInputs =
      this.createOperation<SpendingTransactionInputsResponse>(SPENDING_TX_INPUTS_QUERY);
  }

  #loadServerUrl() {
    storage.local
      .get("settings")
      .then((s) => this.setUrl((s.graphQLServer as string) ?? DEFAULT_SERVER_URL));
  }

  async getAddressesInfo(addresses: string[]): Promise<AddressInfo[]> {
    const response = await this.#getAddressInfo({ addresses });
    return response.data.addresses.map(addressInfoMapper);
  }

  async getHeight(): Promise<number | undefined> {
    try {
      const response = await this.#getCurrentHeight();
      return response.data.blockHeaders[0]?.height;
    } catch (e) {
      log.error("Failed to fetch current height", e);
    }
  }

  /** Returns `undefined` when it fails, e.g. on servers that predate `state.params`. */
  async getMinValuePerByte(): Promise<number | undefined> {
    try {
      const response = await this.#getChainParams();
      return response.data.state.params?.minValuePerByte;
    } catch (e) {
      log.error("Failed to fetch chain parameters", e);
    }
  }

  async checkBoxesOlderThan(height: number, addresses: string[]): Promise<boolean> {
    if (isEmpty(addresses)) return false;

    const chunks = chunk(addresses, MAX_PARAMS_PER_REQUEST);
    for (const addresses of chunks) {
      const response = await this.#checkOldBoxes({ maxHeight: height, addresses });
      if (response.data.boxes.length) return true;
    }

    return false;
  }

  async getAssetsMetadata(tokenIds: string[]): Promise<IAssetInfo[] | undefined> {
    const metadataChunks: Token[][] = [];
    const chunks = chunk(tokenIds, MAX_PARAMS_PER_REQUEST);

    try {
      for (const tokenIds of chunks) {
        const chunkMetadata = await this.#getTokenMetadata({ tokenIds });
        if (isEmpty(chunkMetadata.data.tokens)) return;

        metadataChunks.push(chunkMetadata.data.tokens);
      }
    } catch (e) {
      log.error("Failed to fetch metadata", tokenIds, e);
      return;
    }

    return metadataChunks
      .flat()
      .map(parseEIP4Asset)
      .filter((assetInfo) => assetInfo) as IAssetInfo[];
  }

  override async submitTransaction(
    signedTransaction: SignedTransaction,
    walletId?: number
  ): Promise<TransactionEvaluationSuccess> {
    let result!: TransactionEvaluationResult;
    const shouldRetry = await utxosDbService.containsAtLeastOneOf(
      signedTransaction.inputs.map((i) => i.boxId)
    );

    if (shouldRetry) {
      let attempts = 5;
      let delay = 500;
      while (attempts > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        result = await super.submitTransaction(signedTransaction);

        if (
          result.success ||
          (!result.success &&
            !result.message.startsWith(
              "Malformed transaction: Every input of the transaction should be in UTXO."
            ))
        ) {
          break;
        }

        attempts--;
        delay *= 2;
      }
    } else {
      result = await super.submitTransaction(signedTransaction);
    }

    if (!result.success) throw new Error(result.message);
    else if (walletId) utxosDbService.addFromTx(signedTransaction, walletId);

    return result;
  }

  async getUnspentBoxesByTokenId(tokenId: string, take = 2): Promise<UnspentTokenBox[]> {
    const response = await this.#getUnspentBoxesByToken({ tokenId, take });
    return response.data.boxes;
  }

  /**
   * Input boxes of the confirmed transaction that spent `boxId`, or `undefined` when no
   * main-chain transaction spent it.
   */
  async getSpendingTransactionInputs(boxId: string): Promise<InputBox[] | undefined> {
    const response = await this.#getSpendingTransactionInputs({ boxId });
    const spending = response.data.inputs.find((input) => input.mainChain);
    return spending?.transaction.inputs.map((input) => {
      if (!input.box) throw new Error(`Input box of a transaction spending ${boxId} is missing`);
      return input.box;
    });
  }

  async mempoolTransactionsLookup(txIds: string[]): Promise<Set<string>> {
    const set = new Set<string>();
    const chunks = chunk(txIds, MAX_PARAMS_PER_REQUEST);

    for (const txIds of chunks) {
      const { data } = await this.#checkMempoolTxs({ transactionIds: txIds });
      if (data?.mempool?.transactions?.length === 0) continue;
      for (const tx of data.mempool.transactions) set.add(tx.transactionId);
    }

    return set;
  }
}

export const graphQLService = new GraphQLService();

function addressInfoMapper(gqlAddressInfo: Address): AddressInfo {
  const mapped: AddressInfo = {
    address: gqlAddressInfo.address,
    used: gqlAddressInfo.used,
    assets: gqlAddressInfo.balance.assets.map((t) => ({
      tokenId: t.tokenId,
      confirmedAmount: t.amount
    }))
  };

  if (bn(gqlAddressInfo.balance.nanoErgs).gt(0)) {
    mapped.assets.push({
      tokenId: ERG_TOKEN_ID,
      confirmedAmount: gqlAddressInfo.balance.nanoErgs?.toString() || "0"
    });
  }

  return mapped;
}

function parseEIP4Asset(tokenInfo: Token): IAssetInfo {
  if (!tokenInfo.box) throw new Error("Asset box info is missing");

  const registers = tokenInfo.box.additionalRegisters as Registers;
  const type = safeSigmaDecode<Uint8Array>(registers.R7);
  const assetInfo: IAssetInfo = {
    id: tokenInfo.tokenId,
    mintingBoxId: tokenInfo.boxId,
    mintingTransactionId: tokenInfo.box.transactionId,
    emissionAmount: tokenInfo.emissionAmount,
    name: tokenInfo.name ?? undefined,
    description: tokenInfo.description ?? undefined,
    decimals: tokenInfo.decimals ?? 0,
    type: decodeType(type),
    subtype: decodeSubtype(type),
    standard:
      tokenInfo.type === AssetStandard.EIP4 ? AssetStandard.EIP4 : AssetStandard.Unstandardized
  };

  if (assetInfo.type === AssetType.NFT) {
    const r8 = safeSigmaDecode<Uint8Array>(registers.R8);
    if (r8 && r8.type.toString() === "SColl[SByte]") {
      assetInfo.artworkHash = hex.encode(r8.data);
    }

    const r9 = safeSigmaDecode(registers.R9);
    if (!r9) {
      return assetInfo;
    } else if (r9.type.toString() === "SColl[SByte]") {
      assetInfo.artworkUrl = utf8.encode(r9.data as Uint8Array);
    } else if (r9.type.toString() === "(SColl[SByte], SColl[SByte])") {
      const [url, cover] = r9.data as [Uint8Array, Uint8Array];
      assetInfo.artworkUrl = some(url) ? utf8.encode(url) : undefined;
      assetInfo.artworkCover = some(cover) ? utf8.encode(cover) : undefined;
    }
  }

  return assetInfo;
}

function decodeSubtype(r7?: SConstant<Uint8Array>): AssetSubtype | undefined {
  if (!r7 || r7.type.toString() !== "SColl[SByte]") return;
  return hex.encode(r7.data) as AssetSubtype;
}

function decodeType(r7?: SConstant<Uint8Array>): AssetType {
  if (!r7 || r7.type.toString() !== "SColl[SByte]") return AssetType.Unknown;
  const encoded = hex.encode(r7.data);
  if (encoded.startsWith(AssetType.NFT)) return AssetType.NFT;
  if (encoded.startsWith(AssetType.MembershipToken)) return AssetType.MembershipToken;
  return AssetType.Unknown;
}
