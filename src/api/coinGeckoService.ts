import axios from "axios";

class CoinGeckoService {
  async getPrice() {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=ergo&vs_currencies=usd"
    );

    return response.data;
  }
}

export const coinGeckoService = new CoinGeckoService();
