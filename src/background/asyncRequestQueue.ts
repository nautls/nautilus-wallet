import { EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import { InternalRequest } from "./messaging";

type AsyncRequestBase<T = unknown> = {
  id: number;
  type: InternalRequest;
  origin: string;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason: unknown) => void;
};

export type ConnectionRequest = AsyncRequestBase<boolean> & {
  type: InternalRequest.Connect;
  favicon: string;
};

export type SignTransactionRequest = AsyncRequestBase<SignedTransaction> & {
  type: InternalRequest.SignTx;
  data: EIP12UnsignedTransaction;
};

type AsyncRequest = ConnectionRequest | SignTransactionRequest;

type AsyncRequestInput = Omit<AsyncRequest, "id" | "resolve" | "reject">;

export class AsyncRequestQueue {
  #queue;
  #currentId;

  constructor() {
    this.#queue = [] as AsyncRequest[];
    this.#currentId = 0;
  }

  push<T>(asyncRequest: AsyncRequestInput): Promise<T> {
    const request = asyncRequest as AsyncRequest;
    request.id = this.#currentId++;
    const promise = new Promise<unknown>((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });

    this.#queue.push(request);
    return promise as Promise<T>;
  }

  pop(): AsyncRequest | undefined;
  pop(type: InternalRequest.Connect): ConnectionRequest | undefined;
  pop(type: InternalRequest.SignTx): SignTransactionRequest | undefined;
  pop(type?: InternalRequest): AsyncRequest | undefined {
    if (!type) return this.#queue.pop();

    const index = this.#queue.findLastIndex((x) => x.type === type);
    if (index === -1) return;

    const request = this.#queue[index];
    this.#queue.splice(index, 1);

    return request;
  }

  get(id: number): AsyncRequest | undefined {
    return this.#queue.find((x) => x.id === id);
  }

  remove(id: number): void {
    const index = this.#queue.findIndex((x) => x.id === id);
    if (index > -1) this.#queue.splice(index, 1);
  }

  some(): boolean {
    return this.#queue.length > 0;
  }
}
