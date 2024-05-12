import { chunk, first, isEmpty, min } from "lodash-es";
import { ErgoBox, ErgoTx, Registers } from "@/types/connector";
import { asDict } from "@/utils/serializer";
import { isZero } from "@/utils/bigNumbers";
import { CHUNK_DERIVE_LENGTH, ERG_DECIMALS, ERG_TOKEN_ID, MAINNET } from "@/constants/ergo";
import { AssetStandard } from "@/types/internal";
import { parseEIP4Asset } from "./eip4Parser";
import { IAssetInfo } from "@/types/database";
import BigNumber from "bignumber.js";
import { Address, Box, Header, Info, SignedTransaction, State, Token } from "@ergo-graphql/types";
import { Client, createClient, gql, fetchExchange, TypedDocumentNode } from "@urql/core";
import { retryExchange } from "@urql/exchange-retry";

export type AssetBalance = {
  tokenId: string;
  name?: string;
  decimals?: number;
  standard?: AssetStandard;
  confirmedAmount: string;
  unconfirmedAmount?: string;
  address: string;
};

export type UnspentBoxesInfo = {
  oldest: number | undefined;
  count: number;
};

export const MIN_SERVER_VERSION = [0, 4, 4];
const MAX_RESULTS_PER_REQUEST = 50;
const MAX_PARAMS_PER_REQUEST = 20;

const GRAPHQL_SERVERS = MAINNET
  ? [
      "https://gql.ergoplatform.com/",
      "https://graphql.erg.zelcore.io/",
      "https://explore.sigmaspace.io/api/graphql"
    ]
  : ["https://gql-testnet.ergoplatform.com/", "https://tn-ergo-explorer.anetabtc.io/graphql"];

export function getDefaultServerUrl(): string {
  return GRAPHQL_SERVERS[0];
}

export function getRandomServerUrl(): string {
  return GRAPHQL_SERVERS[Math.floor(Math.random() * GRAPHQL_SERVERS.length)];
}

export async function getServerInfo(url: string): Promise<{ network: string; version: string }> {
  const client = createClient({ url, exchanges: [fetchExchange] });
  const query = gql<{ info: Info; state: State }>`
    query Info {
      info {
        version
      }
      state {
        network
      }
    }
  `;

  const response = await client.query(query, {}).toPromise();
  if (!response.data) {
    throw new Error(`No data returned from ${url}.`);
  }

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

class GraphQLService {
  private _queryClient!: Client;
  private _txBroadcastClient?: Client;
  private _url!: string;

  constructor() {
    this._url = this._getCurrentServerUrl();
    this._queryClient = this._createQueryClient();
  }

  private _createTxBroadcastClient(): Client {
    const defaultUrl = this._url;

    return createClient({
      url: defaultUrl,
      requestPolicy: "network-only",
      exchanges: [
        retryExchange({
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          randomDelay: true,
          maxNumberAttempts: 6,
          retryWith(error, operation) {
            const context = {
              ...operation.context,
              url:
                error.message && !error.message.match(/.*[iI]nput.*not found$/gm)
                  ? getRandomServerUrl()
                  : defaultUrl
            };
            return { ...operation, context };
          }
        }),
        fetchExchange
      ]
    });
  }

  private _createQueryClient(): Client {
    return createClient({
      url: this._url,
      requestPolicy: "network-only",
      exchanges: [
        retryExchange({
          initialDelayMs: 100,
          maxDelayMs: 5000,
          randomDelay: true,
          maxNumberAttempts: 3,
          retryWith(error, operation) {
            if (error.networkError) {
              const context = { ...operation.context, url: getRandomServerUrl() };
              return { ...operation, context };
            }

            return null;
          }
        }),
        fetchExchange
      ]
    });
  }

  private _getCurrentServerUrl() {
    const rawSettings = localStorage.getItem("settings");
    if (!rawSettings) {
      return getDefaultServerUrl();
    }

    const url = JSON.parse(rawSettings).graphQLServer;
    return !url ? getDefaultServerUrl() : url;
  }

  private _getTxBroadcastClient(): Client {
    if (!this._txBroadcastClient) {
      this._txBroadcastClient = this._createTxBroadcastClient();
    }

    return this._txBroadcastClient;
  }

  public updateServerUrl(url: string) {
    if (this._url === url) {
      return;
    }

    this._url = url;
    this._queryClient = this._createQueryClient();
    this._txBroadcastClient = undefined;
  }

  public async getAddressesBalance(addresses: string[]): Promise<AssetBalance[]> {
    if (CHUNK_DERIVE_LENGTH >= addresses.length) {
      const raw = await this.getAddressesBalanceFromChunk(addresses);
      return this._parseAddressesBalanceResponse(raw || []);
    }

    const chunks = chunk(addresses, CHUNK_DERIVE_LENGTH);
    let balances: Address[] = [];
    for (const chunk of chunks) {
      balances = balances.concat((await this.getAddressesBalanceFromChunk(chunk)) || []);
    }

    return this._parseAddressesBalanceResponse(balances);
  }

  private _parseAddressesBalanceResponse(addressesInfo: Address[]): AssetBalance[] {
    let assets: AssetBalance[] = [];

    for (const addressInfo of addressesInfo.filter((r) => !isZero(r.balance.nanoErgs))) {
      assets = assets.concat(
        addressInfo.balance.assets.map((t) => {
          return {
            tokenId: t.tokenId,
            name: t.name || undefined,
            decimals: t.decimals || 0,
            standard: t.name || t.decimals ? AssetStandard.EIP4 : AssetStandard.Unstandardized,
            confirmedAmount: t.amount,
            address: addressInfo.address
          };
        })
      );

      assets.push({
        tokenId: ERG_TOKEN_ID,
        name: "ERG",
        decimals: ERG_DECIMALS,
        standard: AssetStandard.Native,
        confirmedAmount: addressInfo.balance.nanoErgs?.toString() || "0",
        address: addressInfo.address
      });
    }

    return assets;
  }

  public async getAddressesBalanceFromChunk(addresses: string[]): Promise<Address[] | undefined> {
    const query = gql<{ addresses: Address[] }>`
      query Addresses($addresses: [String!]!) {
        addresses(addresses: $addresses) {
          address
          balance {
            nanoErgs
            assets {
              amount
              tokenId
              name
              decimals
            }
          }
        }
      }
    `;

    const response = await this._queryClient.query(query, { addresses }).toPromise();
    return response.data?.addresses;
  }

  public async getUsedAddresses(addresses: string[]): Promise<string[]> {
    if (CHUNK_DERIVE_LENGTH >= addresses.length) {
      return this.getUsedAddressesFromChunk(addresses);
    }

    const chunks = chunk(addresses, CHUNK_DERIVE_LENGTH);
    let used: string[] = [];
    for (const c of chunks) {
      used = used.concat(await this.getUsedAddressesFromChunk(c));
    }

    return used;
  }

  private async getUsedAddressesFromChunk(addresses: string[]): Promise<string[]> {
    const query = gql<{ addresses: Address[] }>`
      query Addresses($addresses: [String!]!) {
        addresses(addresses: $addresses) {
          address
          used
        }
      }
    `;

    const response = await this._queryClient.query(query, { addresses }).toPromise();
    return response.data?.addresses.filter((x) => x.used).map((x) => x.address) || [];
  }

  async getCurrentHeight(): Promise<number | undefined> {
    const query = gql<{ blockHeaders: Header[] }>`
      query query {
        blockHeaders(take: 1) {
          height
        }
      }
    `;

    const response = await this._queryClient.query(query, {}).toPromise();
    return first(response.data?.blockHeaders)?.height;
  }

  public async getUnspentBoxes(addresses: string[]): Promise<ErgoBox[]> {
    const query = gql`
      query Boxes($addresses: [String!], $skip: Int, $take: Int) {
        boxes(addresses: $addresses, skip: $skip, take: $take, spent: false) {
          boxId
          transactionId
          value
          creationHeight
          index
          ergoTree
          additionalRegisters
          assets {
            tokenId
            amount
          }
        }
      }
    `;

    let boxes: ErgoBox[] = [];
    const addressesChunks = chunk(addresses, MAX_PARAMS_PER_REQUEST);

    for (const addresses of addressesChunks) {
      boxes = boxes.concat(
        await this.queryAddressesChunkUnspentBoxes<ErgoBox>(addresses, query, (box) => {
          return {
            ...box,
            confirmed: true,
            additionalRegisters: box.additionalRegisters as Registers
          };
        })
      );
    }

    return boxes;
  }

  public async getUnspentBoxesInfo(addresses: string[]): Promise<UnspentBoxesInfo> {
    const query = gql`
      query BoxesCreationHeight($addresses: [String!], $skip: Int, $take: Int) {
        boxes(addresses: $addresses, skip: $skip, take: $take, spent: false) {
          creationHeight
        }
      }
    `;

    let heights: number[] = [];
    const addressesChunks = chunk(addresses, MAX_PARAMS_PER_REQUEST);

    for (const addresses of addressesChunks) {
      const chunk = await this.queryAddressesChunkUnspentBoxes(
        addresses,
        query,
        (box) => box.creationHeight
      );

      heights = heights.concat(chunk);
    }

    return { oldest: min(heights), count: heights.length };
  }

  public async getMempoolBoxes(address: string): Promise<ErgoBox[]> {
    const query = gql<{ mempool: { boxes: Box[] } }>`
      query MempoolBoxes($address: String!, $skip: Int, $take: Int) {
        mempool {
          boxes(address: $address, skip: $skip, take: $take) {
            boxId
            transactionId
            value
            creationHeight
            index
            ergoTree
            additionalRegisters
            assets {
              tokenId
              amount
            }
          }
        }
      }
    `;

    let boxes: Box[] = [];
    let lastChunkLength = 0;
    let skip = 0;

    do {
      const response = await this._queryClient
        .query(query, { address, skip, take: MAX_RESULTS_PER_REQUEST })
        .toPromise();
      skip += MAX_RESULTS_PER_REQUEST;
      lastChunkLength = response.data?.mempool.boxes.length || 0;

      if (response.data && !isEmpty(response.data?.mempool.boxes)) {
        boxes = boxes.concat(response.data.mempool.boxes);
      }
    } while (lastChunkLength === MAX_RESULTS_PER_REQUEST);

    return (
      boxes.map((box) => {
        return {
          ...box,
          confirmed: false,
          additionalRegisters: box.additionalRegisters as Registers
        };
      }) || []
    );
  }

  private async queryAddressesChunkUnspentBoxes<T>(
    addresses: string[],
    query: TypedDocumentNode<{ boxes: Box[] }>,
    map: (box: Box) => T
  ): Promise<T[]> {
    let boxes: Box[] = [];
    let lastChunkLength = 0;
    let skip = 0;

    do {
      const response = await this._queryClient
        .query(query, { addresses, skip, take: MAX_RESULTS_PER_REQUEST })
        .toPromise();
      skip += MAX_RESULTS_PER_REQUEST;
      lastChunkLength = response.data?.boxes.length || 0;

      if (response.data && !isEmpty(response.data?.boxes)) {
        boxes = boxes.concat(response.data.boxes);
      }
    } while (lastChunkLength === MAX_RESULTS_PER_REQUEST);

    return boxes.map(map) || [];
  }

  public async getTokenInfo(tokenId: string): Promise<Token | undefined> {
    const query = gql<{ tokens: Token[] }>`
      query Tokens($tokenId: String) {
        tokens(tokenId: $tokenId) {
          tokenId
          type
          emissionAmount
          name
          description
          decimals
          boxId
          box {
            transactionId
            additionalRegisters
          }
        }
      }
    `;

    const response = await this._queryClient.query(query, { tokenId }).toPromise();
    return first(response.data?.tokens);
  }

  public async getAssetInfo(tokenId: string): Promise<IAssetInfo | undefined> {
    try {
      const tokenInfo = await this.getTokenInfo(tokenId);
      if (!tokenInfo) {
        return;
      }

      return parseEIP4Asset(tokenInfo);
    } catch {
      return;
    }
  }

  public async getAssetsInfo(tokenIds: string[]): Promise<IAssetInfo[]> {
    const info: (IAssetInfo | undefined)[] = [];
    for (const tokenId of tokenIds) {
      info.push(await this.getAssetInfo(tokenId));
    }

    return info.filter((assetInfo) => assetInfo) as IAssetInfo[];
  }

  public async getBlockHeaders(options: { take: number } = { take: 10 }): Promise<Header[]> {
    const query = gql<{ blockHeaders: Header[] }>`
      query Headers($take: Int) {
        blockHeaders(take: $take) {
          headerId
          parentId
          version
          height
          difficulty
          adProofsRoot
          stateRoot
          transactionsRoot
          timestamp
          nBits
          extensionHash
          powSolutions
          votes
        }
      }
    `;

    const response = await this._queryClient.query(query, options).toPromise();
    return response.data?.blockHeaders ?? [];
  }

  public async checkTx(signedTx: SignedTransaction): Promise<string> {
    const query = gql<{ checkTransaction: string }>`
      mutation Mutation($signedTransaction: SignedTransaction!) {
        checkTransaction(signedTransaction: $signedTransaction)
      }
    `;

    const response = await this._queryClient
      .mutation(query, { signedTransaction: signedTx })
      .toPromise();

    if (response.error) {
      throw Error(response.error.message);
    }

    return response.data?.checkTransaction || "";
  }

  public async sendTx(signedTx: SignedTransaction): Promise<string> {
    const query = gql<{ submitTransaction: string }>`
      mutation Mutation($signedTransaction: SignedTransaction!) {
        submitTransaction(signedTransaction: $signedTransaction)
      }
    `;

    const response = await this._getTxBroadcastClient()
      .mutation(query, { signedTransaction: signedTx })
      .toPromise();

    if (response.error) {
      throw Error(response.error.message);
    }

    return response.data?.submitTransaction || "";
  }

  public async isTransactionInMempool(transactionId: string): Promise<boolean | undefined> {
    try {
      const query = gql<{ mempool: { transactions: { transactionId: string }[] } }>`
        query Mempool($transactionId: String) {
          mempool {
            transactions(transactionId: $transactionId) {
              transactionId
            }
          }
        }
      `;

      const response = await this._getTxBroadcastClient()
        .query(query, { transactionId })
        .toPromise();

      if (response.error || !response.data) {
        return undefined;
      }

      return response.data.mempool.transactions.length > 0;
    } catch {
      return undefined;
    }
  }

  public async areTransactionsInMempool(
    txIds: string[]
  ): Promise<{ [txId: string]: boolean | undefined }> {
    return asDict(
      await Promise.all(
        txIds.map(async (txId) => ({
          [txId]: await this.isTransactionInMempool(txId)
        }))
      )
    );
  }

  public mapTransaction(signedTx: ErgoTx): SignedTransaction {
    return {
      id: signedTx.id,
      size: signedTx.size,
      inputs: signedTx.inputs.map((input) => {
        return { boxId: input.boxId, spendingProof: input.spendingProof };
      }),
      dataInputs: signedTx.dataInputs,
      outputs: signedTx.outputs.map((output) => {
        return {
          boxId: output.boxId,
          value: this._asString(output.value),
          ergoTree: output.ergoTree,
          creationHeight: output.creationHeight,
          index: output.index,
          transactionId: output.transactionId,
          assets: output.assets.map((a) => {
            return {
              tokenId: a.tokenId,
              amount: this._asString(a.amount.toString())
            };
          }),
          additionalRegisters: output.additionalRegisters
        };
      })
    };
  }

  private _asString(value?: string | bigint | BigNumber | number): string {
    if (!value) {
      return "";
    } else if (typeof value == "string") {
      return value;
    } else {
      return value.toString();
    }
  }
}

export const graphQLService = new GraphQLService();
