import { Network } from "@fleet-sdk/common";

export const MAINNET = import.meta.env.NETWORK !== "testnet";
export const NETWORK = MAINNET ? Network.Mainnet : Network.Testnet;
export const ERG_TOKEN_ID = "0000000000000000000000000000000000000000000000000000000000000000";
export const DEFAULT_WALLET_STRENGTH = 160;
export const DERIVATION_PATH = "m/44'/429'/0'/0";
export const ERG_DECIMALS = 9;
export const SAFE_MIN_FEE_VALUE = 1100000;
export const MIN_BOX_VALUE = 1000000;
export const CHUNK_DERIVE_LENGTH = 20;
export const MAINNET_MINER_FEE_TREE =
  "1005040004000e36100204a00b08cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ea02d192a39a8cc7a701730073011001020402d19683030193a38cc7b2a57300000193c2b2a57301007473027303830108cdeeac93b1a57304";
export const SIGMA_CONSTANT_PK_MATCHER = new RegExp(/08cd([0-9a-fA-F]{66})|^07([0-9a-fA-F]{66})$/);
export const P2PK_TREE_PREFIX = "0008cd";
export const PK_HEX_LENGTH = 66;
export const TOKEN_ID_LENGTH = 64;

const MINUTES_IN_A_YEAR = 365 * 24 * 60;
export const BLOCK_TIME_IN_MINUTES = 2;
export const BLOCKS_IN_A_YEAR = MINUTES_IN_A_YEAR / BLOCK_TIME_IN_MINUTES;
export const HEALTHY_BLOCKS_AGE = BLOCKS_IN_A_YEAR * 3;
export const HEALTHY_UTXO_COUNT = 100;
