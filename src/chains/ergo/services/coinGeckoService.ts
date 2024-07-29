import { safeFetch } from "@/common/networking";

const BASE_URL = "https://api.coingecko.com/api/v3/";
type CoinGeckoResponse = {
  ergo: Record<string, number>;
};

class CoinGeckoService {
  async getPrice(currency: string): Promise<number> {
    const response = await safeFetch<CoinGeckoResponse>("simple/price", {
      baseURL: BASE_URL,
      query: { ids: "ergo", vs_currencies: currency }
    });

    return response?.ergo[currency] ?? 0;
  }

  async getSupportedCurrencyConversion(): Promise<string[]> {
    const response = await safeFetch<string[]>("simple/supported_vs_currencies", {
      baseURL: BASE_URL
    });

    return response ?? [];
  }
}

export const coinGeckoService = new CoinGeckoService();
