export class TxSignError extends Error {
  constructor(errorMessage: string) {
    super(errorMessage);
    this.name = this.constructor.name;
  }
}

export class PasswordError extends Error {
  constructor(errorMessage: string = "Wrong password.") {
    super(errorMessage);
    this.name = this.constructor.name;
  }
}
