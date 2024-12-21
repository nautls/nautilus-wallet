import { safeFetch } from "@/common/networking";

const BASE_URL = "https://api.coingecko.com/api/v3/";
type SimplePriceResponse = {
  ergo: Record<string, number>;
};

type ChartResponse = {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
};

class CoinGeckoService {
  #coin = "ergo";

  async getPrice(currency: string): Promise<number> {
    const response = await safeFetch<SimplePriceResponse>("simple/price", {
      baseURL: BASE_URL,
      query: { vs_currencies: currency, ids: this.#coin }
    });

    return response?.ergo[currency] ?? 0;
  }

  async getPriceChart(currency: string, days: number = 1): Promise<[number, number][]> {
    const response = await safeFetch<ChartResponse>(`coins/${this.#coin}/market_chart`, {
      baseURL: BASE_URL,
      query: { vs_currency: currency, days }
    });

    return response?.prices ?? [[0, 0]];
  }

  async getSupportedCurrencyConversion(): Promise<string[]> {
    const response = await safeFetch<string[]>("simple/supported_vs_currencies", {
      baseURL: BASE_URL
    });

    return response ?? [];
  }
}

export const coinGeckoService = new CoinGeckoService();
