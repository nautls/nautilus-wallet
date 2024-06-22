import type { SignDataArgs, SignTxArgs, SignTxInputsArgs } from "@/types/d.ts/webext-rpc";
import { InternalRequest } from "@/rpc/protocol";

export type AsyncRequest<T = unknown> = {
  type: InternalRequest;
  origin: string;
  favicon?: string;
  data: T;

  resolve: <K = unknown>(value: K | PromiseLike<K>) => void;
  reject: (reason: unknown) => void;
};

type AsyncRequestInput = Omit<AsyncRequest, "id" | "resolve" | "reject">;

export type AsyncRequestType =
  | InternalRequest.Connect
  | InternalRequest.SignTx
  | InternalRequest.SignTxInputs
  | InternalRequest.Auth
  | InternalRequest.SignData;

export class AsyncRequestQueue {
  #queue;

  constructor() {
    this.#queue = [] as AsyncRequest[];
  }

  push<T>(asyncRequest: AsyncRequestInput): Promise<T> {
    const request = asyncRequest as AsyncRequest;
    const promise = new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });

    this.#queue.push(request);
    return promise as Promise<T>;
  }

  pop(): AsyncRequest | undefined;
  pop(type: InternalRequest.Auth): AsyncRequest<SignDataArgs> | undefined;
  pop(type: InternalRequest.Connect): AsyncRequest | undefined;
  pop(type: InternalRequest.SignTx): AsyncRequest<SignTxArgs> | undefined;
  pop(type: InternalRequest.SignTxInputs): AsyncRequest<SignTxInputsArgs> | undefined;
  pop(type?: InternalRequest): AsyncRequest | undefined {
    if (!type) return this.#queue.pop();

    const index = this.#queue.findLastIndex((x) => x.type === type);
    if (index === -1) return;

    const request = this.#queue[index];
    this.#queue.splice(index, 1);

    return request;
  }

  some(): boolean {
    return this.#queue.length > 0;
  }
}
