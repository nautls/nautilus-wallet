/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly GIT_COMMIT_HASH: string;
  readonly VITE_ENV: "development" | "staging" | "production";
  readonly NETWORK: "mainnet" | "testnet";
  readonly TARGET: "firefox" | "chrome" | "ios" | "android";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
