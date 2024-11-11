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

## Get addresses

To retrieve wallet addresses, you can use the following methods:

- **`ergo.get_change_address()`**: this method returns the wallet's primary address.
- **`ergo.get_used_addresses()`**: this method returns an `array` of used addresses.
- **`ergo.get_unused_addresses()`**: this method returns an `array` of unused addresses.

## Get UTxOs

You can use the `ergo.get_utxos()` method to fetch unspent UTxOs owned by the selected wallet.

```ts
const utxos = await ergo.get_utxos();
```

The code above returns an array of all UTxOs owned by the selected wallet.

### Filter UTxOs

The `get_utxos()` method supports filters by `Token ID` and `amount`. The code below fetches all UTxOs containing the SigUSD token.

```ts
const sigUSDTokenId = "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04";
const sigUsdUtxos = await ergo.get_utxos({ tokens: [{ tokenId: sigUSDTokenId }] }); // [!code focus]
```

If needed, a target amount can be specified, so that the wallet returns UTxOs until the target is met.

```ts
const sigUSDTokenId = "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04";
const sigUsdUtxos = await ergo.get_utxos({
  tokens: [
    {
      tokenId: sigUSDTokenId,
      amount: "100" // [!code focus]
    }
  ]
});
```

:::tip
Note that the `tokens` field is an `array`, which means you can filter by various tokens in the same call.
:::

## Get the current height

The current height stands for the latest block number included in the blockchain. This is necessary for transaction building.

You can make use of `ergo.get_current_height()` to get it.

```ts
const currentHeight = await ergo.get_current_height();
```
