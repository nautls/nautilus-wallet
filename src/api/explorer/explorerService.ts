import { API_URL } from "@/constants/explorer";
import {
  AddressAPIResponse,
  AssetBalance,
  AssetPriceRate,
  ErgoDexPool,
  ExplorerBlockHeaderResponse,
  ExplorerBox,
  ExplorerPostApiV1MempoolTransactionsSubmitResponse,
  ExplorerV0TransactionsPerAddressResponse,
  ExplorerV1AddressBalanceResponse
} from "@/types/explorer";
import axios from "axios";
import axiosRetry from "axios-retry";
import { chunk, find, isEmpty, uniqWith } from "lodash";
import JSONBig from "json-bigint";
import { ErgoTx } from "@/types/connector";
import { asDict } from "@/utils/serializer";
import { isZero } from "@/utils/bigNumbers";
import { ERG_DECIMALS, ERG_TOKEN_ID, MAINNET } from "@/constants/ergo";
import { AssetStandard } from "@/types/internal";
import { parseEIP4Asset } from "./eip4Parser";
import { IAssetInfo } from "@/types/database";
import BigNumber from "bignumber.js";
import main from "mdi-vue";

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

class ExplorerService {
  public async getTxHistory(
    address: string,
    params?: {
      offset?: number;
      limit?: number;
      concise?: boolean;
    }
  ): Promise<AddressAPIResponse<ExplorerV0TransactionsPerAddressResponse>> {
    const response = await axios.get(`${API_URL}/api/v0/addresses/${address}/transactions`, {
      params
    });

    return { address, data: response.data };
  }

  public async getAddressBalance(
    address: string
  ): Promise<AddressAPIResponse<ExplorerV1AddressBalanceResponse>> {
    const response = await axios.get(`${API_URL}/api/v1/addresses/${address}/balance/total`);
    return { address, data: response.data };
  }

  public async getAddressesBalance(
    addresses: string[],
    options = { chunkBy: 20 }
  ): Promise<AssetBalance[]> {
    if (options.chunkBy <= 0 || options.chunkBy >= addresses.length) {
      const raw = await this.getAddressesBalanceFromChunk(addresses);
      return this._parseAddressesBalanceResponse(raw);
    }

    const chunks = chunk(addresses, options.chunkBy);
    let balances: AddressAPIResponse<ExplorerV1AddressBalanceResponse>[] = [];
    for (const c of chunks) {
      balances = balances.concat(await this.getAddressesBalanceFromChunk(c));
    }

    return this._parseAddressesBalanceResponse(balances);
  }

  private _parseAddressesBalanceResponse(
    apiResponse: AddressAPIResponse<ExplorerV1AddressBalanceResponse>[]
  ): AssetBalance[] {
    let assets: AssetBalance[] = [];

    for (const balance of apiResponse.filter((r) => !this._isEmptyBalance(r.data))) {
      if (!balance.data) {
        continue;
      }

      assets = assets.concat(
        balance.data.confirmed.tokens.map((t) => {
          return {
            tokenId: t.tokenId,
            name: t.name,
            decimals: t.decimals,
            standard:
              t.tokenType === AssetStandard.EIP4
                ? AssetStandard.EIP4
                : AssetStandard.Unstandardized,
            confirmedAmount: t.amount?.toString() || "0",
            address: balance.address
          };
        })
      );

      assets.push({
        tokenId: ERG_TOKEN_ID,
        name: "ERG",
        decimals: ERG_DECIMALS,
        standard: AssetStandard.Native,
        confirmedAmount: balance.data.confirmed.nanoErgs?.toString() || "0",
        unconfirmedAmount: balance.data.unconfirmed.nanoErgs?.toString(),
        address: balance.address
      });
    }

    return assets;
  }

  private _isEmptyBalance(balance: ExplorerV1AddressBalanceResponse): boolean {
    return (
      isZero(balance.confirmed.nanoErgs) &&
      isZero(balance.unconfirmed.nanoErgs) &&
      isEmpty(balance.confirmed.tokens) &&
      isEmpty(balance.unconfirmed.tokens)
    );
  }

  public async getAddressesBalanceFromChunk(
    addresses: string[]
  ): Promise<AddressAPIResponse<ExplorerV1AddressBalanceResponse>[]> {
    return await Promise.all(addresses.map((a) => this.getAddressBalance(a)));
  }

  public async getUsedAddresses(addresses: string[], options = { chunkBy: 20 }): Promise<string[]> {
    if (options.chunkBy <= 0 || options.chunkBy >= addresses.length) {
      return this.getUsedAddressesFromChunk(addresses);
    }

    const chunks = chunk(addresses, options.chunkBy);
    let used: string[] = [];
    for (const c of chunks) {
      used = used.concat(await this.getUsedAddressesFromChunk(c));
    }

    return used;
  }

  private async getUsedAddressesFromChunk(addresses: string[]): Promise<string[]> {
    const resp = await Promise.all(
      addresses.map((address) => this.getTxHistory(address, { limit: 1, concise: true }))
    );

    const usedRaw = resp.filter((r) => r.data.total > 0);
    const used: string[] = [];
    for (const addr of addresses) {
      if (find(usedRaw, (x) => addr === x.address)) {
        used.push(addr);
      }
    }

    return used;
  }

  private async getAddressUnspentBoxes(
    address: string
  ): Promise<AddressAPIResponse<ExplorerBox[]>> {
    const response = await axios.get(
      `${API_URL}/api/v0/transactions/boxes/byAddress/unspent/${address}`
    );

    return { address, data: response.data };
  }

  public async getBox(boxId: string): Promise<ExplorerBox> {
    const response = await axios.get(`${API_URL}/api/v0/transactions/boxes/${boxId}`);
    return response.data;
  }

  public async getMintingBox(tokenId: string): Promise<ExplorerBox> {
    const response = await axios.get(`${API_URL}/api/v0/assets/${tokenId}/issuingBox`);
    return response.data[0];
  }

  public async getBoxes(boxIds: string[]): Promise<ExplorerBox[]> {
    return await Promise.all(boxIds.map((id) => this.getBox(id)));
  }

  public async getUnspentBoxes(addresses: string[]): Promise<AddressAPIResponse<ExplorerBox[]>[]> {
    return await Promise.all(addresses.map((a) => this.getAddressUnspentBoxes(a)));
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
  }): Promise<ExplorerBlockHeaderResponse[]> {
    const response = await axios.get(`${API_URL}/api/v1/blocks/headers`, { params });
    return response.data.items;
  }

  public async sendTx(
    signedTx: ErgoTx
  ): Promise<ExplorerPostApiV1MempoolTransactionsSubmitResponse> {
    const response = await axios.post(
      MAINNET
        ? `${API_URL}/api/v1/mempool/transactions/submit`
        : `http://213.239.193.208:9052/transactions`,
      JSONBig.stringify(signedTx),
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
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

    return MAINNET ? response.data : { id: response.data };
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

export const explorerService = new ExplorerService();
