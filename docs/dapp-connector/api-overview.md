# API Overview

Nautilus provides a convenient and easy way for dApps to interact with wallets through its dApp Connector API, also known as EIP-12 protocol. The protocol provides a seamless bridge between your dApp and the user's wallet, enabling secure and efficient communication. This ensures that your dApp can perform necessary operations such as balance checks and transaction signing with the user's permission.

The dApp Connector API is an asynchronous wrapper on top of a `JSON-RPC` protocol that is injected into the browser's page context by the Nautilus Wallet extension. It's divided into two main parts: the **Connection API** and the **Context API**, as described below.

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

Once the connection request is accepted by the user, this API will be injected similarly to the Connection API, allowing interaction through the `ergo` object. Alternatively it can be returned by the `ergoConnector.nautilus.connect()` method as demonstrated in the [Wallet connection](/dapp-connector/wallet-connection) section.

```ts
await ergo.get_balance();
```

## Types

For a better development experience, Nautilus maintains a static typing library for the dApp Connector protocol. Follow the steps below to get types working in your TypeScript project.

### Step. 1: Install the package

Add `@nautilus-js/eip12-types` as a `dev-dependency`for your project.

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

### Step. 2: Tweak the `tsconfig.json` file

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
