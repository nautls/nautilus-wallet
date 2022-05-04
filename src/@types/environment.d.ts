declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GIT_HASH: string;
      MAINNET: boolean;
    }
  }
}

// convert it into a module by adding an empty export statement.
export {};
