import { API_URL } from "@/constants/explorer";
import {
  AssetBalance,
  AssetPriceRate,
  ErgoDexPool,
  ExplorerPostApiV1MempoolTransactionsSubmitResponse
} from "@/types/explorer";
import axios from "axios";
import axiosRetry from "axios-retry";
import { chunk, first, uniqWith } from "lodash";
import JSONBig from "json-bigint";
import { ErgoBox, ErgoTx, Registers } from "@/types/connector";
import { asDict } from "@/utils/serializer";
import { isZero } from "@/utils/bigNumbers";
import { CHUNK_DERIVE_LENGTH, ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";
import { AssetStandard } from "@/types/internal";
import { parseEIP4Asset } from "./eip4Parser";
import { IAssetInfo } from "@/types/database";
import BigNumber from "bignumber.js";
import { Address, Box, Header, Token } from "@ergo-graphql/types";
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
  private readonly _graphQLClient!: Client;

  constructor() {
    this._graphQLClient = createClient({
      url: getRandomServer(),
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

    const response = await this._graphQLClient.query(query, { addresses }).toPromise();
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

    const response = await this._graphQLClient.query(query, { addresses }).toPromise();
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

    const response = await this._graphQLClient.query(query, { address }).toPromise();
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

    const response = await this._graphQLClient.query(query, { tokenId }).toPromise();
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

    const response = await this._graphQLClient.query(query, options).toPromise();
    return response.data?.blockHeaders ?? [];
  }

  public async sendTx(
    signedTx: ErgoTx
  ): Promise<ExplorerPostApiV1MempoolTransactionsSubmitResponse> {
    const response = await axios.post(
      `${API_URL}/api/v1/mempool/transactions/submit`,
      JSONBig.stringify(signedTx),
      {
        "axios-retry": {
          retries: 15,
          shouldResetTimeout: true,
          retryDelay: axiosRetry.exponentialDelay,
          retryCondition: (error) => {
            const data = error.response?.data as any;
            if (!data) {
              return true;
            }
            // retries until pending box gets accepted by the mempool
            return data.status === 400 && data.reason.match(/.*[iI]nput.*not found$/gm);
          }
        }
      }
    );

    return response.data;
  }

  public async isTransactionInMempool(txId: string): Promise<boolean | undefined> {
    try {
      const response = await axios.get(`${API_URL}/api/v0/transactions/unconfirmed/${txId}`, {
        "axios-retry": {
          retries: 5,
          shouldResetTimeout: true,
          retryDelay: axiosRetry.exponentialDelay,
          retryCondition: (error) => {
            const data = error.response?.data as any;
            return !data || data.status === 404;
          }
        }
      });
      return response.data != undefined;
    } catch (e: any) {
      const data = e?.response?.data;
      if (data && data.status === 404) {
        return false;
      }

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
