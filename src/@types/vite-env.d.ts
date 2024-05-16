/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly GIT_COMMIT_HASH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
