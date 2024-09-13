import { spectrumService } from "./spectrumService";
import { coinGeckoService } from "./coinGeckoService";
import { ERG_TOKEN_ID } from "@/constants/ergo";

const MIN_USD_LIQUIDITY = 1_000;

export type AssetRate = { erg: number; fiat: number };

class AssetPricingService {
  async getRates(fiatCurrency: string): Promise<Map<string, AssetRate>> {
    const [ergFiatRate, tokenRates] = await Promise.all([
      coinGeckoService.getPrice(fiatCurrency),
      spectrumService.getRatesByLiquidity(MIN_USD_LIQUIDITY)
    ]);

    const rates = new Map<string, AssetRate>([[ERG_TOKEN_ID, { erg: 1, fiat: ergFiatRate }]]);
    if (!tokenRates) return rates;
    for (const [key, value] of tokenRates) {
      rates.set(key, { erg: value.toNumber(), fiat: value.times(ergFiatRate).toNumber() });
    }

    return rates;
  }
}

export const assetPricingService = new AssetPricingService();
