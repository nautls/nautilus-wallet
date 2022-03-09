import { API_URL } from "@/constants/explorer";
import {
  AddressAPIResponse,
  ExplorerBlockHeaderResponse,
  ExplorerBox,
  ExplorerGetApiV1BlocksP1Response,
  ExplorerGetApiV1BlocksResponse,
  ExplorerPostApiV1MempoolTransactionsSubmitResponse,
  ExplorerV0TransactionsPerAddressResponse,
  ExplorerV1AddressBalanceResponse
} from "@/types/explorer";
import axios from "axios";
import axiosRetry from "axios-retry";
import { chunk, find, Primitive } from "lodash";
import JSONBig from "json-bigint";
import { ExplorerTokenMarket, ITokenRate } from "ergo-market-lib";
import { ErgoTx } from "@/types/connector";

const explorerTokenMarket = new ExplorerTokenMarket({ explorerUri: API_URL });
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

function asDict<T>(array: T[]) {
  return Object.assign({}, ...array);
}

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
  ): Promise<AddressAPIResponse<ExplorerV1AddressBalanceResponse>[]> {
    if (options.chunkBy <= 0 || options.chunkBy >= addresses.length) {
      return await this.getAddressesBalanceFromChunk(addresses);
    }

    const chunks = chunk(addresses, options.chunkBy);
    let balances: AddressAPIResponse<ExplorerV1AddressBalanceResponse>[] = [];
    for (const c of chunks) {
      balances = balances.concat(await this.getAddressesBalanceFromChunk(c));
    }

    return balances;
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

  public async getBoxes(boxIds: string[]): Promise<ExplorerBox[]> {
    return await Promise.all(boxIds.map((id) => this.getBox(id)));
  }

  public async getUnspentBoxes(addresses: string[]): Promise<AddressAPIResponse<ExplorerBox[]>[]> {
    return await Promise.all(addresses.map((a) => this.getAddressUnspentBoxes(a)));
  }

  public async getLastTenBlockHeaders(): Promise<ExplorerBlockHeaderResponse[]> {
    const blocks = await this.getBlocks({ limit: 10 });
    return (await Promise.all(blocks.items.map((b: any) => this.getBlock(b.id)))).map(
      (b: any) => b.block.header
    );
  }

  public async getBlock(blockId: string): Promise<ExplorerGetApiV1BlocksP1Response> {
    const response = await axios.get(`${API_URL}/api/v1/blocks/${blockId}`);
    return response.data;
  }

  public async getBlocks(params?: {
    offset?: number;
    limit?: number;
    sortBy?: string;
    sortDirection?: string;
  }): Promise<ExplorerGetApiV1BlocksResponse> {
    const response = await axios.get(`${API_URL}/api/v1/blocks/`, { params });
    return response.data;
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
            const data = error.response?.data;
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
            const data = error.response?.data;
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

  public async getTokenMarketRates(): Promise<ITokenRate[]> {
    return explorerTokenMarket.getTokenRates();
  }
}

export const explorerService = new ExplorerService();
