import { AssetBalance, AssetPriceRate, ErgoDexPool } from "@/types/explorer";
import axios from "axios";
import axiosRetry from "axios-retry";
import { chunk, first, uniqWith } from "lodash";
import { ErgoBox, ErgoTx, Registers } from "@/types/connector";
import { asDict } from "@/utils/serializer";
import { isZero } from "@/utils/bigNumbers";
import { CHUNK_DERIVE_LENGTH, ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";
import { AssetStandard } from "@/types/internal";
import { parseEIP4Asset } from "./eip4Parser";
import { IAssetInfo } from "@/types/database";
import BigNumber from "bignumber.js";
import { Address, Box, Header, SignedTransaction, Token } from "@ergo-graphql/types";
import { Client, createClient, gql, fetchExchange, dedupExchange } from "@urql/core";
import { retryExchange } from "@urql/exchange-retry";

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });
const servers = [
  "https://gql.ergoplatform.com/",
  "https://graphql.erg.zelcore.io/",
  "https://ergo-explorer.getblok.io/graphql/"
];

function getRandomServer(): string {
  return servers[Math.floor(Math.random() * servers.length)];
}

class GraphQLService {
  private readonly _gqlClient!: Client;
  private _sendTxGqlClient?: Client;

  private get _sendTxGraphQLClient(): Client {
    if (!this._sendTxGqlClient) {
      this._sendTxGqlClient = createClient({
        url: servers[0],
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
                const context = { ...operation.context, url: getRandomServer() };
                return { ...operation, context };
              }

              return null;
            }
          }),
          fetchExchange
        ]
      });
    }

    return this._sendTxGqlClient;
  }

  constructor() {
    this._gqlClient = createClient({
      url: servers[0],
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
              const context = { ...operation.context, url: getRandomServer() };
              return { ...operation, context };
            }

            return null;
          }
        }),
        fetchExchange
      ]
    });
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

    const response = await this._gqlClient.query(query, { addresses }).toPromise();
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

    const response = await this._gqlClient.query(query, { addresses }).toPromise();
    return response.data?.addresses.filter((x) => x.used).map((x) => x.address) || [];
  }

  public async getUnspentBoxes(addresses: string[]): Promise<ErgoBox[]> {
    let boxes: ErgoBox[] = [];
    for (const address of addresses) {
      boxes = boxes.concat(await this.getAddressUnspentBoxes(address));
    }

    return boxes;
  }

  private async getAddressUnspentBoxes(address: string): Promise<ErgoBox[]> {
    const query = gql<{ boxes: Box[] }>`
      query Boxes($address: String) {
        boxes(address: $address, spent: false) {
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

    const response = await this._gqlClient.query(query, { address }).toPromise();
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

    const response = await this._gqlClient.query(query, { tokenId }).toPromise();
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

    const response = await this._gqlClient.query(query, options).toPromise();
    return response.data?.blockHeaders ?? [];
  }

  public async checkTx(signedTx: SignedTransaction): Promise<string> {
    const query = gql<{ checkTransaction: string }>`
      mutation Mutation($signedTransaction: SignedTransaction!) {
        checkTransaction(signedTransaction: $signedTransaction)
      }
    `;

    const response = await this._gqlClient
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

    const response = await this._sendTxGraphQLClient
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

      const response = await this._sendTxGraphQLClient.query(query, { transactionId }).toPromise();
      if (response.error || !response.data) {
        return undefined;
      }
      console.log(response.data.mempool.transactions);
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

  private getUtcTimestamp(date: Date) {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    );
  }

  public async getTokenRates(): Promise<AssetPriceRate> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    const { data } = await axios.get<ErgoDexPool[]>(`https://api.ergodex.io/v1/amm/markets`, {
      params: {
        from: this.getUtcTimestamp(fromDate),
        to: this.getUtcTimestamp(new Date())
      }
    });

    const filtered = uniqWith(
      data.filter((x) => x.baseId === ERG_TOKEN_ID),
      (a, b) =>
        a.quoteId === b.quoteId && new BigNumber(a.baseVolume.value).isLessThan(b.baseVolume.value)
    );

    return asDict(
      filtered.map((r) => {
        return {
          [r.quoteId]: {
            erg: new BigNumber(1).dividedBy(r.lastPrice).toNumber()
          }
        };
      })
    );
  }
}

export const graphQLService = new GraphQLService();
