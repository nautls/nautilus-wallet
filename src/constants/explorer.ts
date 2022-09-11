import { MAINNET } from "./ergo";

export const ADDRESS_URL = MAINNET
  ? "https://explorer.ergoplatform.com/en/addresses/"
  : "https://testnet.ergoplatform.com/en/addresses/";
export const TRANSACTION_URL = MAINNET
  ? "https://explorer.ergoplatform.com/en/transactions/"
  : "https://testnet.ergoplatform.com/en/transactions/";
