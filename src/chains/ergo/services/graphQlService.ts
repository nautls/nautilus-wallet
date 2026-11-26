import { ErgoGraphQLProvider } from "@fleet-sdk/blockchain-providers";
import { MAINNET } from "@/constants/ergo";

const FALLBACK_GRAPHQL_SERVERS = MAINNET
  ? ["https://gql.ergoplatform.com/", "https://graphql.erg.zelcore.io/"]
  : [];

const GRAPHQL_SERVER_URL = MAINNET
  ? "https://explore.sigmaspace.io/api/graphql"
  : "https://gql-testnet.ergoplatform.com/";

class GraphQLService extends ErgoGraphQLProvider<string> {
  constructor() {
    super({
      url: GRAPHQL_SERVER_URL,
      retry: { attempts: 5, delay: 500, fallbacks: FALLBACK_GRAPHQL_SERVERS }
    });

    this.setBigIntMapper((value) => value);
  }
}

export const graphQLService = new GraphQLService();
