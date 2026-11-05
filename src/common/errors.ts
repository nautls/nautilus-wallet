export class TxSignError extends Error {
  constructor(errorMessage: string) {
    super(errorMessage);
    this.name = this.constructor.name;
  }
}

export class PasswordError extends Error {
  /**
   * @param kind which password was wrong, for flows that ask for two: the master
   * password, or the wallet's own.
   * @param walletIds the wallets whose own password was wrong, for flows that ask for several.
   */
  constructor(
    errorMessage = "Wrong password.",
    readonly kind?: "master" | "password",
    readonly walletIds?: number[]
  ) {
    super(errorMessage);
    this.name = this.constructor.name;
  }
}
