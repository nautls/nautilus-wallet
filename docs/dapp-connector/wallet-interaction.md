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

### Get Balance by `Token ID`

You can pass a `Token ID` as the parameter of the `get_balance()` method to get the balance of a specific token.

```ts
const sigUsdBalance = await ergo.get_balance(
  "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04"
);
```

### Get Balance for All Assets

To get the balance off all assets held by the connected wallet, pass the constant `all` as the parameter of the `get_balance()` method.

```ts
const fullBalance = await ergo.get_balance("all");
```

The code above returns an `array` with the balance of all assets owned by the connected wallet, following this structure:

```ts
{ tokenId: string, balance: string }[];
```

## Get Addresses

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
Note that the `tokens` property is an `array`, which means you can filter by various tokens in the same call.
:::

## Get the Current Height

The current height stands for the latest block number included in the blockchain. This is necessary for transaction building.

You can make use of `ergo.get_current_height()` to get it.

```ts
const currentHeight = await ergo.get_current_height();
```

## Sign a Transaction

You can request a transaction signature by calling the `ergo.sign_tx()` method and passing an unsigned transaction object as parameter.

```ts
const unsignedTransaction = new TransactionBuilder(currentHeight)
  .from(inputs)
  .to(new OutputBuilder(1000000n, recipientAddress))
  .sendChangeTo(changeAddress)
  .payMinFee()
  .build()
  .toEIP12Object();

const signedTransaction = await ergo.sign_tx(unsignedTransaction); // [!code focus]
```

When `ergo.sign_tx()` is called, a pop-up window will be displayed to the user, asking them to review and sign the transaction. If the user signs it successfully, the method will return a signed transaction `object` that can be submitted to the blockchain. Otherwise, it will throw an exception.

:::info
As the focus of this guide is specifically on the **dApp Connector** protocol, we will not cover the details of the transaction-building process. For more information on transaction building, please refer to the [Fleet SDK documentation](https://fleet-sdk.github.io/docs/transaction-building).
:::

### Submit a Transaction

Now you have a signed transaction you can submit it to the blockchain using the `ergo.submit_tx()` method.

```ts
const transactionId = await ergo.submit_tx(signedTransaction);
```

If the transaction is successfully accepted by the mempool, a `string` containing the `Transaction ID` will be returned otherwise, it will throw an exception.

## Sign Arbitrary Data

### Verify Signature
