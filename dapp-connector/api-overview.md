---
url: /dapp-connector/api-overview.md
---
# API Overview

Nautilus provides a convenient and easy way for dApps to interact with wallets through its dApp Connector API, also known as the EIP-12 protocol. The protocol provides a seamless bridge between your dApp and the user's wallet, enabling secure and efficient communication. This allows your dApp to perform operations such as balance checks and transaction signing with the user's permission.

The dApp Connector API is an asynchronous, `Promise`-based API injected into the browser's page context by the Nautilus Wallet extension. It's divided into two main parts: the **Connection API** and the **Context API**, as described below.

:::warning
**Work-in-Progress**: Non-reviewed text. You may find numerous writing errors throughout this guide.
:::

## Connection API

The Connection API is responsible for handling wallet connection requests and providing initial information about available EIP-12 compatible wallet applications.

EIP-12 compatible browser wallets on Ergo, like Nautilus, automatically inject the **Connection API** into every active page, allowing any page context to interact with it directly through the `ergoConnector` object.

### Multi-wallet support

The Connection API is designed to support multiple wallets. To connect to a wallet, use the `ergoConnector.{walletId}.connect()` method, where `{walletId}` is the wallet of your choice. For our example, we will use `nautilus`.

```ts
await ergoConnector.nautilus.connect();
```

## Context API

The Context API is responsible for handling wallet-related requests such as retrieving balances, signing transactions, and more.

Once the connection request is accepted by the user, this API is injected similarly to the Connection API, allowing interaction through the global `ergo` object. Alternatively, it can be obtained through the `ergoConnector.nautilus.getContext()` method, as demonstrated in the [Connecting to a Wallet](/dapp-connector/wallet-connection#avoid-creating-the-global-ergo-object) section.

```ts
await ergo.get_balance();
```

## Static Types

For a better development experience, Nautilus [maintains a static typing library](https://github.com/capt-nemo429/eip12-types) for the dApp Connector protocol. Follow the steps below to get types working in your TypeScript project.

### Step 1: Install the package

Add `@nautilus-js/eip12-types` as a dev dependency of your project.

::: code-group

```bash [npm]
npm i @nautilus-js/eip12-types -D
```

```bash [pnpm]
pnpm add @nautilus-js/eip12-types -D
```

```bash [bun]
bun add @nautilus-js/eip12-types -D
```

```bash [yarn]
yarn add @nautilus-js/eip12-types -D
```

:::

### Step 2: Tweak the `tsconfig.json` file

Add `@nautilus-js/eip12-types` to the `compilerOptions.types` array.

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    // ...
    // Add "@nautilus-js/eip12-types" to the types array
    "types": ["@nautilus-js/eip12-types"]
  }
}
```

## Errors

When a Context API call fails, the returned `Promise` is rejected with a plain object (not an `Error` instance) with the following structure:

```ts
interface APIError {
  code: number;
  info: string; // human-readable description
}
```

The `code` property is one of the values below. Note that some codes overlap across groups, so interpret them based on the method you called.

| Method                                           | Code | Name              | Description                                                                 |
| ------------------------------------------------ | ---- | ----------------- | --------------------------------------------------------------------------- |
| Any                                              | `-1` | `InvalidRequest`  | Invalid parameters, unsupported pagination, or the dApp is not connected.   |
| Any                                              | `-2` | `InternalError`   | Something went wrong inside the wallet.                                     |
| Any                                              | `-3` | `Refused`         | The request was refused, e.g., the user declined `sign_data` or `auth`.     |
| `sign_tx`, `sign_tx_inputs`, `sign_data`, `auth` | `1`  | `ProofGeneration` | The wallet was unable to generate the proof.                                |
| `sign_tx`, `sign_tx_inputs`                      | `2`  | `UserDeclined`    | The user declined the request.                                              |
| `submit_tx`                                      | `1`  | `Refused`         | The transaction was rejected by the node, e.g., double-spending or invalid. |

```ts
try {
  const signedTx = await ergo.sign_tx(unsignedTx);
} catch (e) {
  const { code, info } = e as { code: number; info: string };
  if (code === 2) console.log("User declined the transaction.");
  else console.error(`Signing failed (${code}): ${info}`);
}
```
