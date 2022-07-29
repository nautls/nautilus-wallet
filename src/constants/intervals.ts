import { MAINNET } from "./ergo";

export const PRICE_FETCH_INTERVAL = 5 * 30 * 1000;
export const REFRESH_BALANCE_INTERVAL = (MAINNET ? 30 : 3) * 1000;
export const MIN_UTXO_SPENT_CHECK_TIME = (MAINNET ? 60 : 5) * 1000;
