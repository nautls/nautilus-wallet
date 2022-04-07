import axios from "axios";

const BASE_URI = "https://api.coingecko.com/api/v3";

class CoinGeckoService {
  async getPrice(currency: string): Promise<number> {
    const response = await axios.get(`${BASE_URI}/simple/price?ids=ergo&vs_currencies=${currency}`);
    return response.data.ergo[currency];
  }

  async getSupportedCurrencyConversion(): Promise<string[]> {
    const response = await axios.get(`${BASE_URI}/simple/supported_vs_currencies`);
    return response.data;
  }
}

export const coinGeckoService = new CoinGeckoService();
