import { BigNumber } from "bignumber.js";
import { uniqWith } from "lodash-es";
import { bn } from "@/common/bigNumber";
import { safeFetch } from "@/common/networking";
import { ERG_TOKEN_ID } from "@/constants/ergo";

const _1 = bn(1);

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

  async getRatesByLiquidity(minUsdLiquidity: number): Promise<Map<string, BigNumber> | undefined> {
    const [markets, liquidTokens] = await Promise.all([
      spectrumService.getActivePools(),
      spectrumService.getTokenIdsByLiquidity(minUsdLiquidity)
    ]);
    if (!markets) return;

    const rates = uniqWith(
      markets.filter((p) => p.baseId === ERG_TOKEN_ID && liquidTokens.includes(p.quoteId)),
      (a, b) => a.quoteId === b.quoteId && a.baseVolume.value <= b.baseVolume.value
    );

    const map = new Map<string, BigNumber>();
    for (const pool of rates) map.set(pool.quoteId, _1.div(pool.lastPrice));

    return map;
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
