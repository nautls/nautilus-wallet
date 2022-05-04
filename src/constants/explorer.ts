import { MAINNET } from "./ergo";

export const API_URL = MAINNET
  ? "https://api.ergoplatform.com"
  : "https://api-testnet.ergoplatform.com";
export const ADDRESS_URL = MAINNET
  ? "https://explorer.ergoplatform.com/en/addresses/"
  : "https://testnet.ergoplatform.com/en/addresses/";
export const TRANSACTION_URL = MAINNET
  ? "https://explorer.ergoplatform.com/en/transactions/"
  : "https://testnet.ergoplatform.com/en/transactions/";
