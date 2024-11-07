# API Overview

Nautilus provides a convenient and easy way for dApps to interact with wallets through its dApp Connector API, also known as EIP-12 protocol.

The dApp Connector API is an asynchronous wrapper on top of a `JSON-RPC` protocol that is injected into the browser's page context by the Nautilus Wallet extension. It's divided into two main parts: the **Connection API** and the **Context API**, as described below.

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

#### Example

```ts
await ergo.get_balance();
```
