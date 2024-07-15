import { safeFetch } from "@/common/networking";
import { ERG_TOKEN_ID } from "@/constants/ergo";

export type AssetPriceRate = {
  [tokenId: string]: { erg: number };
};

// https://api.spectrum.fi/v1/docs
const BASE_URL = "https://api.spectrum.fi";

export type SpectrumPool = {
  id: string;
  baseId: string;
  baseSymbol: string;
  quoteId: string;
  quoteSymbol: string;
  lastPrice: number;
  baseVolume: SpectrumPoolVolume;
  quoteVolume: SpectrumPoolVolume;
};

export type SpectrumPoolVolume = {
  value: number;
};

export type SpectrumPoolStat = {
  id: string;
  lockedX: SpectrumLockedValue;
  lockedY: SpectrumLockedValue;
  tvl: { value: number };
};

export type SpectrumLockedValue = {
  id: string;
  amount: number;
  ticker: string;
  decimals: number;
};

class SpectrumService {
  #liquidTokensIds?: string[];

  async getPoolsStats(): Promise<SpectrumPoolStat[] | undefined> {
    return safeFetch("v1/amm/pools/stats", { baseURL: BASE_URL });
  }

  async getTokenIdsByLiquidity(minUsdLiquidity: number): Promise<string[]> {
    if (this.#liquidTokensIds) return this.#liquidTokensIds;

    const stats = await spectrumService.getPoolsStats();
    if (!stats) return [];

    this.#liquidTokensIds = stats
      .filter((x) => x.lockedX.id === ERG_TOKEN_ID && x.tvl.value >= minUsdLiquidity)
      .map((x) => x.lockedY.id);
    return this.#liquidTokensIds;
  }

  async getActivePools(fromDays = 30): Promise<SpectrumPool[] | undefined> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - fromDays);

    return safeFetch("v1/price-tracking/markets", {
      baseURL: BASE_URL,
      query: {
        from: this.#getUtcTimestamp(fromDate),
        to: this.#getUtcTimestamp(new Date())
      }
    });
  }

  #getUtcTimestamp(date: Date) {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    );
  }
}

export const spectrumService = new SpectrumService();
