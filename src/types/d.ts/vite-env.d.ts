/// <reference types="vite/client" />
/// <reference types="vite-svg-loader" />

interface ImportMetaEnv {
  readonly GIT_COMMIT_HASH: string;
  readonly VITE_ENV: "development" | "staging" | "production";
  readonly NETWORK: "mainnet" | "testnet";
  readonly TARGET: "firefox" | "chrome" | "ios" | "android";
  /** Test name registry NFT, set only in end-to-end test builds. */
  readonly NAME_REGISTRY_NFT_ID: string;
  /** SHA-256 of the test name registrar's ErgoTree, set only in end-to-end test builds. */
  readonly NAME_REGISTRAR_TREE_HASH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
