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
   */
  constructor(
    errorMessage = "Wrong password.",
    readonly kind?: "master" | "password"
  ) {
    super(errorMessage);
    this.name = this.constructor.name;
  }
}
