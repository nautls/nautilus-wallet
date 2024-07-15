import { MAINNET } from "./ergo";

export const REFRESH_BALANCE_INTERVAL = (MAINNET ? 30 : 30) * 1000;
export const MIN_UTXO_SPENT_CHECK_TIME = (MAINNET ? 60 : 30) * 1000;
