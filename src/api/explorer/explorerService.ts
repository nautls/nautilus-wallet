import { API_URL } from "@/constants/explorer";
import {
  AddressAPIResponse,
  ExplorerBlockHeaderResponse,
  ExplorerGetApiV1BlocksP1Response,
  ExplorerGetApiV1BlocksResponse,
  ExplorerPostApiV1MempoolTransactionsSubmitResponse,
  ExplorerV0TransactionsPerAddressResponse,
  ExplorerV1AddressBalanceResponse
} from "@/types/explorer";
import axios from "axios";
import { chunk, find, Primitive } from "lodash";

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
    return await Promise.all(addresses.map(a => this.getAddressBalance(a)));
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
      addresses.map(address => this.getTxHistory(address, { limit: 1, concise: true }))
    );

    const usedRaw = resp.filter(r => r.data.total > 0);
    const used: string[] = [];
    for (const addr of addresses) {
      if (find(usedRaw, x => addr === x.address)) {
        used.push(addr);
      }
    }

    return used;
  }

  public async getUnspentBoxes(address: string): Promise<AddressAPIResponse<any>> {
    const response = await axios.get(
      `${API_URL}/api/v0/transactions/boxes/byAddress/unspent/${address}`
    );

    return { address, data: response.data };
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

  public async sendTx(tx: any): Promise<ExplorerPostApiV1MempoolTransactionsSubmitResponse> {
    const response = await axios.post(`${API_URL}/api/v1/mempool/transactions/submit`, tx);
    return response.data;
  }
}

export const explorerService = new ExplorerService();
