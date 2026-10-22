---
url: /dapp-connector/wallet-interaction.md
---
# Interacting With a Wallet

Once we gain access to the wallet, we can interact with it through the [Context API](/dapp-connector/api-overview#context-api). [As explained earlier](/dapp-connector/wallet-connection#avoid-creating-the-global-ergo-object), this API may or may not be globally injected into your dApp's context, depending on your implementation.

:::warning
**Work-in-Progress**: Non-reviewed text. You may find numerous writing errors throughout this guide.
:::

## Get Balance

Let's start by getting the wallet's balance. To do this, use the `ergo.get_balance()` method.

```ts
const nanoErgBalance = await ergo.get_balance();
```

By default, the `get_balance()` method returns the ERG balance in **nanoERGs** (1 ERG = 109 nanoERGs) as a `string`, but parameters can be used to extend or refine the results. Token balances are likewise returned in their smallest unit, without applying the token's decimals.

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

To get the balance of all assets held by the connected wallet, pass the constant `all` as the parameter of the `get_balance()` method.

```ts
const fullBalance = await ergo.get_balance("all");
```

The code above returns an `array` with the balance of all assets owned by the connected wallet, following this structure:

```ts
{ tokenId: string, balance: string }[];
```

The ERG balance is included in this list with `tokenId` set to `"ERG"`.

## Get Addresses

To retrieve wallet addresses, you can use the following methods:

* **`ergo.get_change_address()`**: returns the wallet's change address as a `string`. This is the address that should receive the change of transactions built by your dApp.
* **`ergo.get_used_addresses()`**: returns an `array` of addresses that have been used in the blockchain.
* **`ergo.get_unused_addresses()`**: returns an `array` of addresses that have not been used yet.

:::info
Pagination, as described in the EIP-12 specification, is not supported. Passing a pagination argument to `get_used_addresses()`, `get_unused_addresses()` or `get_utxos()` throws an `InvalidRequest` [error](/dapp-connector/api-overview#errors).
:::

## Get UTxOs

You can use the `ergo.get_utxos()` method to fetch unspent UTxOs owned by the connected wallet.

```ts
const utxos = await ergo.get_utxos();
```

The code above returns an array of all UTxOs owned by the connected wallet.

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
  confirmed: boolean; // false if the box was created by a transaction still in the mempool
}
```

### Filter UTxOs

The `get_utxos()` method accepts a selection target to filter the UTxOs by `nanoErgs` and `tokens`. The code below fetches all UTxOs containing the SigUSD token.

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

The same works for ERG, by specifying a `nanoErgs` target. The code below fetches enough UTxOs to cover 1 ERG.

```ts
const utxos = await ergo.get_utxos({ nanoErgs: "1000000000" });
```

:::tip
The `tokens` property is an `array`, and it can be combined with `nanoErgs`, which means you can select UTxOs for several assets in the same call.
:::

:::warning
If the wallet doesn't hold enough funds to meet the target, an empty `array` is returned instead of an error.
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

When `ergo.sign_tx()` is called, a pop-up window will be displayed to the user, asking them to review and sign the transaction. If the user signs it successfully, the method will return a signed transaction `object` that can be submitted to the blockchain. Otherwise, it throws an [error](/dapp-connector/api-overview#errors) with the `UserDeclined` code if the user declines, or `ProofGeneration` if the wallet can't sign it.

:::info
As the focus of this guide is specifically on the **dApp Connector** protocol, we will not cover the details of the transaction-building process. For more information on transaction building, please refer to the [Fleet SDK documentation](https://fleet-sdk.github.io/docs/transaction-building).
:::

### Unsigned Transaction Type Definitions

The `sign_tx()` method requires the transaction object to be structured in a slightly different way than what's required by the node: the `inputs` and `dataInputs` properties must be full [Box objects](#utxo-type-definitions), instead of objects containing only the `boxId`.

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

type TokenAmount = { tokenId: string; amount: string };
type NonMandatoryRegisters = Partial<Record<"R4" | "R5" | "R6" | "R7" | "R8" | "R9", string>>;
```

### Sign Specific Inputs

In multi-party scenarios, where a transaction spends inputs owned by different wallets, you can ask Nautilus to sign only some of the inputs by calling `ergo.sign_tx_inputs()` with the unsigned transaction and the indexes of the inputs to be signed.

```ts
const signedInputs = await ergo.sign_tx_inputs(unsignedTransaction, [0, 2]); // [!code focus]
```

The indexes must be unique and within the bounds of the transaction's `inputs` array. If the user signs it, the method returns an `array` with the signed inputs, in the same order as the requested indexes:

```ts
interface SignedInput {
  boxId: string;
  spendingProof: {
    proofBytes: string;
    extension: Record<string, string>;
  };
}
```

You can then combine the signed inputs from each party to build the final signed transaction.

### Submit a Transaction

Now that you have a signed transaction, you can submit it to the blockchain using the `ergo.submit_tx()` method.

```ts
// ...
const transactionId = await ergo.submit_tx(signedTransaction);
```

If the transaction is accepted by the mempool, a `string` containing the transaction ID is returned. Otherwise, it throws an [error](/dapp-connector/api-overview#errors):

* `InvalidRequest` (`-1`) if the transaction is malformed, e.g., its `id` doesn't match its contents;
* `Refused` (`1`) if the node rejects the transaction.

## Sign Arbitrary Data

Nautilus supports arbitrary data signing through the `ergo.sign_data()` method. This method takes two arguments to prompt the user for a signature:

1. **`address`**: the address whose private key should sign the data. It must belong to the connected wallet.
2. **`data`**: the data to be signed, which can be a `string`, a `number`, a `JSON` object, or an `array` of them.

```ts
const address = await ergo.get_change_address();
const data = { foo: "bar", baz: 1 };
const proof = await ergo.sign_data(address, data); // [!code focus]
```

The code above asks Nautilus to prompt the user to review and sign the data. If the user signs it successfully, the method will return the signature proof as a hexadecimal `string` that can be further verified by a prover. Otherwise, it throws an [error](/dapp-connector/api-overview#errors).

:::warning
Data signing is not supported by Ledger and read-only wallets.
:::

### Verify Data Signature

The `sign_data()` method uses the [EIP-44](https://github.com/ergoplatform/eips/blob/master/eip-0044.md) standard to sign arbitrary data. To verify signatures, you'll need a prover that supports this standard, such as the one provided by [Fleet SDK](https://github.com/fleet-sdk/fleet). Below is an example of how you can verify a data signature generated by Nautilus.

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

## Authenticate

The `ergo.auth()` method proves that the user controls a given address, which is useful for logging into a backend service. It takes two arguments:

1. **`address`**: the address to authenticate with. It must belong to the connected wallet.
2. **`message`**: a `string`, typically a nonce issued by your backend.

```ts
const address = await ergo.get_change_address();
const { signedMessage, proof } = await ergo.auth(address, nonce); // [!code focus]
```

Before signing, Nautilus extends the message with the requesting dApp's origin, a Unix timestamp (in seconds) and 32 random bytes, so the actual signed message has the following format:

```
{message};{origin};{timestamp};{random hex}
```

The method returns both the `signedMessage` and the hexadecimal `proof`. When verifying it on your backend, make sure that `signedMessage` starts with the nonce you issued, contains your dApp's origin, and has a recent timestamp.

:::warning
Authentication is not supported by Ledger and read-only wallets.
:::
