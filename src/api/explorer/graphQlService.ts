import { API_URL } from "@/constants/explorer";
import {
  AssetBalance,
  AssetPriceRate,
  ErgoDexPool,
  ExplorerBlockHeader,
  ExplorerBox,
  ExplorerPostApiV1MempoolTransactionsSubmitResponse
} from "@/types/explorer";
import axios from "axios";
import axiosRetry from "axios-retry";
import { chunk, uniqWith } from "lodash";
import JSONBig from "json-bigint";
import { ErgoBox, ErgoTx, Registers } from "@/types/connector";
import { asDict } from "@/utils/serializer";
import { isZero } from "@/utils/bigNumbers";
import { CHUNK_DERIVE_LENGTH, ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";
import { AssetStandard } from "@/types/internal";
import { parseEIP4Asset } from "./eip4Parser";
import { IAssetInfo } from "@/types/database";
import BigNumber from "bignumber.js";
import { gql, createClient, Client } from "@urql/core";
import { Address, Box } from "@ergo-graphql/types";

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

class GraphQLService {
  private readonly _gQLClient!: Client;

  constructor() {
    this._gQLClient = createClient({
      url: "https://gql.ergoplatform.com/",
      requestPolicy: "network-only"
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
    const query = gql<{ addresses: Address[] }, { addresses: string[] }>`
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

    return (await this._gQLClient.query(query, { addresses }).toPromise()).data?.addresses;
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
    const query = gql<{ addresses: Address[] }, { addresses: string[] }>`
      query Addresses($addresses: [String!]!) {
        addresses(addresses: $addresses) {
          address
          transactionsCount
        }
      }
    `;

    const response = await this._gQLClient.query(query, { addresses }).toPromise();

    return (
      response.data?.addresses.filter((x) => !isZero(x.transactionsCount)).map((x) => x.address) ||
      []
    );
  }

  public async getUnspentBoxes(addresses: string[]): Promise<ErgoBox[]> {
    const responses = await Promise.all(addresses.map((a) => this.getAddressUnspentBoxes(a)));
    return responses.flat();
  }

  private async getAddressUnspentBoxes(address: string): Promise<ErgoBox[]> {
    const query = gql<{ boxes: Box[] }, { address: string }>`
      query Boxes($address: String) {
        boxes(address: $address, spent: false) {
          boxId
          transactionId
          value
          creationHeight
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

    const response = await this._gQLClient.query(query, { address }).toPromise();
    return (
      response.data?.boxes?.map((box) => {
        return {
          ...box,
          confirmed: true,
          additionalRegisters: box.additionalRegisters as Registers
        };
      }) || []
    );
  }

  public async getMintingBox(tokenId: string): Promise<ExplorerBox> {
    const response = await axios.get(`${API_URL}/api/v0/assets/${tokenId}/issuingBox`);
    return response.data[0];
  }

  public async getAssetInfo(tokenId: string): Promise<IAssetInfo | undefined> {
    try {
      const box = await this.getMintingBox(tokenId);
      return parseEIP4Asset(tokenId, box);
    } catch {
      return;
    }
  }

  public async getAssetsInfo(tokenIds: string[]): Promise<IAssetInfo[]> {
    const info = await Promise.all(tokenIds.map((a) => this.getAssetInfo(a)));
    return info.filter((i) => i) as IAssetInfo[];
  }

  public async getBlockHeaders(params?: {
    offset?: number;
    limit?: number;
    sortBy?: string;
    sortDirection?: string;
  }): Promise<ExplorerBlockHeader[]> {
    const response = await axios.get(`${API_URL}/api/v1/blocks/headers`, { params });
    return response.data.items;
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
