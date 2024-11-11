# Interacting with a wallet

Once we gain access to the wallet, we can interact with it through the [Context API](/dapp-connector/api-overview#context-api). [As explained earlier](wallet-connection#avoid-globally-instantiating-of-the-ergo-object), this API may or may not be globally injected into your dApp's context, depending on your implementation.

## Get Balance

Let's start by getting the wallet's balance. To do this, use the `ergo.get_balance()` method.

```ts
const ergBalance = await ergo.get_balance();
```

By default the `get_balance()` method returns the ERG balance as a `string`, but parameters can be used to extend or refine the results.

:::info
To avoid data loss due to limitations of JavaScript's default JSON parser, please note that all amounts returned by the dApp Connector are encoded as `strings`, even though they represent `integers`. This ensures the accuracy and integrity of the data being processed.
:::

### Get balance by Token ID

You can pass a `Token ID` as the parameter of the `get_balance()` method to get the balance of a specific token.

```ts
const sigUsdBalance = await ergo.get_balance(
  "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04"
);
```

### Get balance for all assets

To get the balance off all assets held by the connected wallet, pass the constant `all` as the parameter of the `get_balance()` method.

```ts
const fullBalance = await ergo.get_balance("all");
```

The code above returns an `array` with the balance of all assets owned by the connected wallet, following this structure:

```ts
{ tokenId: string, balance: string }[];
```
