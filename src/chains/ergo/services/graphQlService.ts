import { Address, Info, State, Token } from "@ergo-graphql/types";
import { hex, utf8 } from "@fleet-sdk/crypto";
import { SConstant } from "@fleet-sdk/serializer";
import { chunk, isEmpty, SignedTransaction, some } from "@fleet-sdk/common";
import {
  createGqlOperation,
  ErgoGraphQLProvider,
  TransactionEvaluationResult,
  TransactionEvaluationSuccess
} from "@fleet-sdk/blockchain-providers";
import { safeSigmaDecode } from "@/chains/ergo/serialization";
import { Registers } from "@/types/connector";
import { ERG_TOKEN_ID, MAINNET } from "@/constants/ergo";
import { AssetStandard, AssetSubtype, AssetType } from "@/types/internal";
import { IAssetInfo } from "@/types/database";
import { bn } from "@/common/bigNumber";
import { log } from "@/common/logger";
import { utxosDbService } from "@/database/utxosDbService";

export type AssetInfo = {
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
  "query Info { info { version } state { network } }"
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
  } catch (e) {
    return false;
  }
}

export async function validateServerNetwork(url: string): Promise<boolean> {
  try {
    const response = await getServerInfo(url);

    return MAINNET ? response.network === "mainnet" : response.network === "testnet";
  } catch (e) {
    return false;
  }
}

const ADDRESS_INFO_QUERY = `query addresses($addresses: [String!]!) { addresses(addresses: $addresses) { address used balance { nanoErgs assets { amount tokenId } } } }`;
const CURRENT_HEIGHT_QUERY = `query currentHeight { blockHeaders(take: 1) { height } }`;
const OLD_BOXES_CHECK_QUERY = `query oldBoxesCheck($maxHeight: Int, $addresses: [String!]) { boxes( maxHeight: $maxHeight addresses: $addresses heightType: creation spent: false take: 1 ) { creationHeight } }`;
const TOKEN_METADATA_QUERY = `query Tokens($tokenIds: [String!]) { tokens(tokenIds: $tokenIds) { tokenId type emissionAmount name description decimals boxId box { transactionId additionalRegisters } } }`;
const MEMPOOL_TXS_QUERY = `query mempoolTxCheck($transactionIds: [String!]) { mempool { transactions(transactionIds: $transactionIds) { transactionId } } }`;

class GraphQLService extends ErgoGraphQLProvider<string> {
  #getAddressInfo;
  #getCurrentHeight;
  #checkOldBoxes;
  #getTokenMetadata;
  #checkMempoolTxs;

  constructor() {
    super({
      url: DEFAULT_SERVER_URL,
      retry: { attempts: 5, delay: 500, fallbacks: FALLBACK_GRAPHQL_SERVERS }
    });

    this.setBigIntMapper((value) => value);
    this.#loadServerUrl();

    this.#getAddressInfo = this.createOperation<{ addresses: Address[] }>(ADDRESS_INFO_QUERY);
    this.#getCurrentHeight = this.createOperation<{ blockHeaders: { height: number }[] }>(
      CURRENT_HEIGHT_QUERY
    );
    this.#checkOldBoxes = this.createOperation<{ boxes: { creationHeight: number }[] }>(
      OLD_BOXES_CHECK_QUERY
    );
    this.#getTokenMetadata = this.createOperation<{ tokens: Token[] }>(TOKEN_METADATA_QUERY);
    this.#checkMempoolTxs = this.createOperation<{
      mempool: { transactions: { transactionId: string }[] };
    }>(MEMPOOL_TXS_QUERY);
  }

  #loadServerUrl() {
    chrome?.storage.local
      .get("settings")
      .then((s) => this.setUrl(s.graphQLServer ?? DEFAULT_SERVER_URL));
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
      return;
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

export function parseEIP4Asset(tokenInfo: Token): IAssetInfo {
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
