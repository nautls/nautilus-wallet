import { MAINNET } from "./ergo";

export const PRICE_FETCH_INTERVAL = 5 * 30 * 1000;
export const REFRESH_BALANCE_INTERVAL = (MAINNET ? 30 : 30) * 1000;
export const MIN_UTXO_SPENT_CHECK_TIME = (MAINNET ? 60 : 30) * 1000;
export const UPDATE_TOKENS_BLACKLIST_INTERVAL = 60 * 60 * 1000;
