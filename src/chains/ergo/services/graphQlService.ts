import { Address } from "@ergo-graphql/types";
import { ErgoGraphQLProvider } from "@fleet-sdk/blockchain-providers";
import { chunk, isEmpty } from "@fleet-sdk/common";
import { bn } from "@/common/bigNumber";
import { ERG_TOKEN_ID, MAINNET } from "@/constants/ergo";

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

const MAX_PARAMS_PER_REQUEST = 20;

const FALLBACK_GRAPHQL_SERVERS = MAINNET
  ? ["https://gql.ergoplatform.com/", "https://graphql.erg.zelcore.io/"]
  : [];

const GRAPHQL_SERVER_URL = MAINNET
  ? "https://explore.sigmaspace.io/api/graphql"
  : "https://gql-testnet.ergoplatform.com/";

const ADDRESS_INFO_QUERY = `query addresses($addresses: [String!]!) { addresses(addresses: $addresses) { address used balance { nanoErgs assets { amount tokenId } } } }`;
const OLD_BOXES_CHECK_QUERY = `query oldBoxesCheck($maxHeight: Int, $addresses: [String!]) { boxes( maxHeight: $maxHeight addresses: $addresses heightType: creation spent: false take: 1 ) { creationHeight } }`;
const MEMPOOL_TXS_QUERY = `query mempoolTxCheck($transactionIds: [String!]) { mempool { transactions(transactionIds: $transactionIds) { transactionId } } }`;

type AddressInfoResponse = { addresses: Address[] };
type OldBoxesCheckResponse = { boxes: { creationHeight: number }[] };
type MempoolTransactionsResponse = { mempool: { transactions: { transactionId: string }[] } };

class GraphQLService extends ErgoGraphQLProvider<string> {
  #getAddressInfo;
  #checkOldBoxes;
  #checkMempoolTxs;

  constructor() {
    super({
      url: GRAPHQL_SERVER_URL,
      retry: { attempts: 5, delay: 500, fallbacks: FALLBACK_GRAPHQL_SERVERS }
    });

    this.setBigIntMapper((value) => value);

    this.#getAddressInfo = this.createOperation<AddressInfoResponse>(ADDRESS_INFO_QUERY);
    this.#checkOldBoxes = this.createOperation<OldBoxesCheckResponse>(OLD_BOXES_CHECK_QUERY);
    this.#checkMempoolTxs = this.createOperation<MempoolTransactionsResponse>(MEMPOOL_TXS_QUERY);
  }

  async getAddressesInfo(addresses: string[]): Promise<AddressInfo[]> {
    const response = await this.#getAddressInfo({ addresses });
    return response.data.addresses.map(addressInfoMapper);
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
