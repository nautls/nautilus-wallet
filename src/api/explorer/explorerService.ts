import { API_URL } from "@/constants/explorer";
import {
  AddressAPIResponse,
  ExplorerV0TransactionsPerAddressResponse,
  ExplorerV1AddressBalanceResponse
} from "@/types/explorer";
import axios from "axios";
import { chunk, find } from "lodash";

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
    addresses: string[]
  ): Promise<AddressAPIResponse<ExplorerV1AddressBalanceResponse>[]> {
    return await Promise.all(addresses.map(a => this.getAddressBalance(a)));
  }

  public async getUsedAddresses(addresses: string[], options = { chunkBy: 0 }): Promise<string[]> {
    if (options.chunkBy <= 0 || options.chunkBy > addresses.length) {
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
}

export const explorerService = new ExplorerService();
