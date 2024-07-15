import { BigNumber } from "bignumber.js";
import { uniqWith } from "lodash-es";
import { spectrumService } from "./spectrumService";
import { coinGeckoService } from "./coinGeckoService";
import { ERG_TOKEN_ID } from "@/constants/ergo";

const _1 = BigNumber(1);
const MIN_USD_LIQUIDITY = 10_000;

export type AssetRate = { erg: number; fiat: number };

async function getSpectrumTokenRates(): Promise<Map<string, BigNumber> | undefined> {
  const [markets, hiLiqTokens] = await Promise.all([
    spectrumService.getActivePools(),
    spectrumService.getTokenIdsByLiquidity(MIN_USD_LIQUIDITY)
  ]);

  if (!markets) return;

  const map = new Map<string, BigNumber>();
  uniqWith(
    markets.filter((p) => p.baseId === ERG_TOKEN_ID && hiLiqTokens.includes(p.quoteId)),
    (a, b) => a.quoteId === b.quoteId && a.baseVolume.value <= b.baseVolume.value
  ).map((pool) => map.set(pool.quoteId, _1.div(pool.lastPrice)));

  return map;
}

class AssetPricingService {
  async getRates(fiatCurrency: string): Promise<Map<string, AssetRate>> {
    const [ergFiatRate, tokenRates] = await Promise.all([
      coinGeckoService.getPrice(fiatCurrency),
      getSpectrumTokenRates()
    ]);

    const rates = new Map<string, AssetRate>([[ERG_TOKEN_ID, { erg: 1, fiat: ergFiatRate }]]);
    if (!tokenRates) return rates;
    for (const [key, value] of tokenRates) {
      rates.set(key, {
        erg: value.toNumber(),
        fiat: value.times(ergFiatRate).toNumber()
      });
    }

    return rates;
  }
}

export const assetPricingService = new AssetPricingService();
