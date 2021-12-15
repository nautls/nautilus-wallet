import { BASE_URL } from "@/constants/explorer";
import axios from "axios";
import { find } from "lodash";

class ExplorerService {
  public async getTxHistory(
    address: string,
    params?: {
      offset?: number;
      limit?: number;
      concise?: boolean;
    }
  ) {
    const response = await axios.get(`${BASE_URL}/api/v0/addresses/${address}/transactions`, {
      params
    });

    return { address, data: response.data };
  }

  public async getAddressBalance(address: string) {
    const response = await axios.get(`${BASE_URL}/api/v1/addresses/${address}/balance/confirmed`);

    return { address, data: response.data };
  }

  public async getAddressesBalance(addresses: string[]) {
    return await Promise.all(addresses.map(a => this.getAddressBalance(a)));
  }

  public async getUsedAddressesFrom(addresses: string[]): Promise<string[]> {
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
