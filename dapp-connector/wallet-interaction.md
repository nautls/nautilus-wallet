---
url: /dapp-connector/wallet-interaction.md
---
# Interacting With a Wallet

Once we gain access to the wallet, we can interact with it through the [Context API](/dapp-connector/api-overview#context-api). [As explained earlier](wallet-connection#avoid-globally-instantiating-of-the-ergo-object), this API may or may not be globally injected into your dApp's context, depending on your implementation.

:::warning
**Work-in-Progress**: Non-reviewed text. You may find numerous writing errors throughout this guide.
:::

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

* **`ergo.get_change_address()`**: this method returns the wallet's primary address.
* **`ergo.get_used_addresses()`**: this method returns an `array` of used addresses.
* **`ergo.get_unused_addresses()`**: this method returns an `array` of unused addresses.

## Get UTxOs

You can use the `ergo.get_utxos()` method to fetch unspent UTxOs owned by the selected wallet.

```ts
const utxos = await ergo.get_utxos();
```

The code above returns an array of all UTxOs owned by the selected wallet.

### UTxO Type Definitions

```ts
interface Box {
  boxId: string;
  transactionId: string;
  index: number;
  ergoTree: string;
  creationHeight: number;
  value: string;
  assets: { tokenId: string; amount: string }[];
  additionalRegisters: Partial<Record<"R4" | "R5" | "R6" | "R7" | "R8" | "R9", string>>;
  confirmed?: boolean; // true if included in the blockchain
}
```

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

### Unsigned Transaction Type Definitions

The `sign_tx()` method requires the transaction object to be structured in a slightly different way than what's required by the node: the `inputs` and `dataInputs` properties must be full [Box objects](#utxo-type-definitions), instead of an object containing the `BoxID`.

```ts
interface UnsignedTransaction {
  inputs: Array<{
    boxId: string;
    transactionId: string;
    index: number;
    ergoTree: string;
    creationHeight: number;
    value: string;
    assets: TokenAmount[];
    additionalRegisters: NonMandatoryRegisters;
    extension: { values?: Record<string, string> };
  }>;

  dataInputs: Array<{
    boxId: string;
    transactionId: string;
    index: number;
    ergoTree: string;
    creationHeight: number;
    value: string;
    assets: TokenAmount[];
    additionalRegisters: NonMandatoryRegisters;
  }>;

  outputs: Array<{
    ergoTree: string;
    creationHeight: number;
    value: string;
    assets: TokenAmount[];
    additionalRegisters: NonMandatoryRegisters;
  }>;
}

type TokenAmount = Array<{ tokenId: string; amount: string }>;
type NonMandatoryRegisters = Partial<Record<"R4" | "R5" | "R6" | "R7" | "R8" | "R9", string>>;
```

### Submit a Transaction

Now you have a signed transaction you can submit it to the blockchain using the `ergo.submit_tx()` method.

```ts
// ...
const transactionId = await ergo.submit_tx(signedTransaction);
```

If the transaction is successfully accepted by the mempool, a `string` containing the `Transaction ID` will be returned otherwise, it will throw an exception.

## Sign Arbitrary Data

Nautilus supports arbitrary data signing through the `ergo.sign_data()` method. This method takes two arguments to prompt the user for a signature:

1. **`address`**: The address from which the data should be signed.
2. **`data`**: The data to be signed, which can be either a `string`, a `number`, a `JSON` object, or an `array` or them.

```ts
const address = await ergo.get_change_address();
const data = { foo: "bar", baz: 1 };
const proof = await ergo.sign_data(address, data); // [!code focus]
```

The code above asks Nautilus to prompt the user to review and sign the data. If the user signs it successfully, the method will return the signature proof as a hexadecimal `string` that can be further verified by a prover. Otherwise, it will throw an exception.

### Verify Data Signature

The `sign_data()` method uses the [EIP-44](https://github.com/ergoplatform/eips/blob/master/eip-0044.md) standard to sign arbitrary data. To verify signatures, you'll need a prover that supports this standard. Currently, only the [Fleet SDK](https://github.com/fleet-sdk/fleet) supports it. Below is an example of how you can verify a data signature generated by Nautilus.

```ts
import { Prover } from "@fleet-sdk/wallet";
import { ErgoAddress, ErgoMessage } from "@fleet-sdk/core";

// ...

const prover = new Prover();
const data = ErgoMessage.fromData({ foo: "bar", baz: 1 });
const [publicKey] = ErgoAddress.decode(address).getPublicKeys();

const verified = prover.verify(data, proof, publicKey);
```

:::info
Note that the `address`, `data`, and `proof` must be the same as in the signing step.
:::
