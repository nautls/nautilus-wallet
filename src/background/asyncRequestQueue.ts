import { UnsignedTransaction } from "@fleet-sdk/common";
import { AuthArgs } from "../@types/webext-rpc";
import { InternalRequest } from "./messaging";

type AsyncRequestBase<T = unknown> = {
  id: number;
  type: InternalRequest;
  origin: string;
  favicon?: string;
  data: T;

  resolve: <K = unknown>(value: K | PromiseLike<K>) => void;
  reject: (reason: unknown) => void;
};

export type ConnectionRequest = AsyncRequestBase<undefined> & {
  type: InternalRequest.Connect;
};

export type SignTransactionRequest<T = unknown> = AsyncRequestBase<T> & {
  type: InternalRequest.SignTx;
};

export type AuthRequest<T = unknown> = AsyncRequestBase<T> & {
  type: InternalRequest.Auth;
};

export type AsyncRequest = ConnectionRequest | SignTransactionRequest | AuthRequest;

type AsyncRequestInput = Omit<AsyncRequest, "id" | "resolve" | "reject">;

export type AsyncRequestType =
  | InternalRequest.Connect
  | InternalRequest.SignTx
  | InternalRequest.Auth;

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
  pop(type: InternalRequest.Auth): AuthRequest<AuthArgs> | undefined;
  pop(type: InternalRequest.Connect): ConnectionRequest | undefined;
  pop(type: InternalRequest.SignTx): SignTransactionRequest<UnsignedTransaction> | undefined;
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
