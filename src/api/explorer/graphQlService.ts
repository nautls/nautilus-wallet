import { chunk, first, isEmpty } from "lodash";
import { ErgoBox, ErgoTx, Registers } from "@/types/connector";
import { asDict } from "@/utils/serializer";
import { isZero } from "@/utils/bigNumbers";
import { CHUNK_DERIVE_LENGTH, ERG_DECIMALS, ERG_TOKEN_ID, MAINNET } from "@/constants/ergo";
import { AssetStandard } from "@/types/internal";
import { parseEIP4Asset } from "./eip4Parser";
import { IAssetInfo } from "@/types/database";
import BigNumber from "bignumber.js";
import { Address, Box, Header, Info, SignedTransaction, State, Token } from "@ergo-graphql/types";
import { Client, createClient, gql, fetchExchange, dedupExchange } from "@urql/core";
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

export const MIN_SERVER_VERSION = [0, 3, 8];
const MAX_RESULTS_PER_REQUEST = 50;
const GRAPHQL_SERVERS = MAINNET
  ? [
      "https://gql.ergoplatform.com/",
      "https://graphql.erg.zelcore.io/",
      "https://ergo-explorer.getblok.io/graphql/"
    ]
  : ["https://gql-testnet.ergoplatform.com/"];

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
    const [major, minor, patch] = response.version.split(".");

    return (
      Number.parseInt(major, 10) === MIN_SERVER_VERSION[0] &&
      Number.parseInt(minor, 10) >= MIN_SERVER_VERSION[1] &&
      Number.parseInt(patch, 10) >= MIN_SERVER_VERSION[2]
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

  private _createQueryClient(): Client {
    return createClient({
      url: this._url,
      requestPolicy: "network-only",
      exchanges: [
        dedupExchange,
        retryExchange({
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          randomDelay: true,
          maxNumberAttempts: 10,
          retryIf(error) {
            return !!(error.networkError || error.message.match(/.*[iI]nput.*not found$/gm));
          },
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

  private _createTxBroadcastClient(): Client {
    return createClient({
      url: this._url,
      requestPolicy: "network-only",
      exchanges: [
        dedupExchange,
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

  public async getUnspentBoxes(addresses: string[]): Promise<ErgoBox[]> {
    let boxes: ErgoBox[] = [];

    for (const address of addresses) {
      let chunk: ErgoBox[];
      let skip = 0;

      do {
        chunk = await this.getAddressUnspentBoxes(address, skip, MAX_RESULTS_PER_REQUEST);
        skip += MAX_RESULTS_PER_REQUEST;
        if (!isEmpty(chunk)) {
          boxes = boxes.concat(chunk);
        }
      } while (chunk.length === MAX_RESULTS_PER_REQUEST);
    }

    return boxes;
  }

  private async getAddressUnspentBoxes(
    address: string,
    skip: number,
    take: number
  ): Promise<ErgoBox[]> {
    const query = gql<{ boxes: Box[] }>`
      query Boxes($address: String, $skip: Int, $take: Int) {
        boxes(address: $address, skip: $skip, take: $take, spent: false) {
          boxId
          transactionId
          value
          creationHeight
          settlementHeight
          index
          ergoTree
          address
          additionalRegisters
          assets {
            tokenId
            amount
          }
        }
      }
    `;

    const response = await this._queryClient.query(query, { address, skip, take }).toPromise();
    return (
      response.data?.boxes.map((box) => {
        return {
          ...box,
          confirmed: true,
          additionalRegisters: box.additionalRegisters as Registers
        };
      }) || []
    );
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
