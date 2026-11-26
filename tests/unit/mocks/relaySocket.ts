import type { ClientMessage, ServerMessage } from "@hergmes/sdk";
import { vi } from "vitest";

type Listener = (event: { data?: string }) => void;

/**
 * A relay's WebSocket, for unit tests that run the SDK's real `Relay`: it records what the
 * client sends and delivers what a test sends as the relay. `install()` makes it the global
 * `WebSocket`, which a `Relay` built without the `WebSocket` option uses.
 */
export class MockSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  /** Every socket opened since `install()`, oldest first. */
  static sockets: MockSocket[] = [];
  /** Answers each message a client sends, on a later task, as a relay would; none by default. */
  static respond?: (message: ClientMessage, socket: MockSocket) => void;

  static install() {
    MockSocket.sockets = [];
    MockSocket.respond = undefined;
    vi.stubGlobal("WebSocket", MockSocket);
  }

  /** The socket opened last. */
  static get last(): MockSocket {
    const socket = MockSocket.sockets.at(-1);
    if (!socket) throw new Error("No socket was opened");
    return socket;
  }

  /** Every message sent on any socket, in order. */
  static get sent(): ClientMessage[] {
    return MockSocket.sockets.flatMap((s) => s.sent);
  }

  readyState = MockSocket.CONNECTING;
  readonly sent: ClientMessage[] = [];
  readonly #listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {
    MockSocket.sockets.push(this);
    // the client adds its listeners right after `new`, so it opens on a later task
    setTimeout(() => {
      if (this.readyState !== MockSocket.CONNECTING) return;
      this.readyState = MockSocket.OPEN;
      this.#dispatch("open", {});
    });
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.#listeners.get(type)?.delete(listener);
  }

  send(text: string) {
    if (this.readyState !== MockSocket.OPEN) throw new Error("The socket isn't open");
    const message = JSON.parse(text) as ClientMessage;
    this.sent.push(message);
    setTimeout(() => {
      if (this.readyState === MockSocket.OPEN) MockSocket.respond?.(message, this);
    });
  }

  close() {
    if (this.readyState === MockSocket.CLOSED) return;
    this.readyState = MockSocket.CLOSED;
    setTimeout(() => this.#dispatch("close", {}));
  }

  /** Sends `message` to the client, as the relay. */
  receive(message: ServerMessage) {
    if (this.readyState !== MockSocket.OPEN) throw new Error("The socket isn't open");
    this.#dispatch("message", { data: JSON.stringify(message) });
  }

  #dispatch(type: string, event: { data?: string }) {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
}
