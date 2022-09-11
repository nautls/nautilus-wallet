import axios from "axios";
import axiosRetry from "axios-retry";
import { uniqWith } from "lodash";
import { asDict } from "@/utils/serializer";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import BigNumber from "bignumber.js";

export type ErgoDexPool = {
  id: string;
  baseId: string;
  baseSymbol: string;
  quoteId: string;
  quoteSymbol: string;
  lastPrice: number;
  baseVolume: ErgoDexPoolVolume;
  quoteVolume: ErgoDexPoolVolume;
};

export type ErgoDexPoolVolume = {
  value: number;
};

export type AssetPriceRate = {
  [tokenId: string]: { erg: number };
};

const BASE_URL = "https://api.ergodex.io/v1";
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

class ErgoDexService {
  public async getTokenRates(): Promise<AssetPriceRate> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    const { data } = await axios.get<ErgoDexPool[]>(`${BASE_URL}/amm/markets`, {
      params: {
        from: this._getUtcTimestamp(fromDate),
        to: this._getUtcTimestamp(new Date())
      }
    });

    const filtered = uniqWith(
      data.filter((x) => x.baseId === ERG_TOKEN_ID),
      (a, b) =>
        a.quoteId === b.quoteId && new BigNumber(a.baseVolume.value).isLessThan(b.baseVolume.value)
    );

    return asDict(
      filtered.map((r) => {
        return {
          [r.quoteId]: { erg: new BigNumber(1).dividedBy(r.lastPrice).toNumber() }
        };
      })
    );
  }

  private _getUtcTimestamp(date: Date) {
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

export const ergoDexService = new ErgoDexService();
