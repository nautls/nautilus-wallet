interface ConsoleLike {
  info(...data: unknown[]): void;
  debug(...data: unknown[]): void;
  error(...data: unknown[]): void;
  warn(...data: unknown[]): void;
}

class Logger {
  #output: ConsoleLike;

  constructor(output: ConsoleLike) {
    this.#output = output;
  }

  info<T>(...data: unknown[]): T {
    this.#output.info(...data);
    return data[0] as T;
  }

  debug<T>(...data: unknown[]): T {
    this.#output.debug(...data);
    return data[0] as T;
  }

  error<T>(...data: unknown[]): T {
    this.#output.error(...data);
    return data[0] as T;
  }

  warn<T>(...data: unknown[]): T {
    this.#output.warn(...data);
    return data[0] as T;
  }
}

export const log = new Logger(console);
