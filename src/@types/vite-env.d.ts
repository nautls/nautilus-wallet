/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly GIT_COMMIT_HASH: string;
  readonly NETWORK: "mainnet" | "testnet";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
