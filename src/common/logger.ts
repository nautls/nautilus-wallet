interface LogOutput {
  info(...data: unknown[]): void;
  debug(...data: unknown[]): void;
  error(...data: unknown[]): void;
  warn(...data: unknown[]): void;
}

class Logger {
  #output: LogOutput;

  constructor(output: LogOutput) {
    this.#output = output;
  }

  info(...data: unknown[]): void {
    this.#output.info(...data);
  }

  debug(...data: unknown[]): void {
    this.#output.debug(...data);
  }

  error(...data: unknown[]): void {
    this.#output.error(...data);
  }

  warn(...data: unknown[]): void {
    this.#output.warn(...data);
  }
}

export const log = new Logger(console);
