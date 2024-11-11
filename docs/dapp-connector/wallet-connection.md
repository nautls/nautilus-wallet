# Connecting to a Wallet

The first step in interacting with Nautilus is to request the access to the user. This is done using the `ergoConnector` object, which is automatically injected into the page context by the Nautilus Wallet web extension.

:::warning
**Work-in-Progress**: Non-reviewed text. You may find numerous writing errors throughout this guide.
:::

## Check if Nautilus is running

To check if the user has the Nautilus Wallet installed and running, check for the presence of the `ergoConnector` and then for `ergoConnector.nautilus`.

<!-- prettier-ignore-start -->
```ts
if (ergoConnector) { // check if the Connection API is injected // [!code focus]
  if (ergoConnector.nautilus) { // check if the Nautilus Wallet is available // [!code focus]
    console.log("Nautilus is ready to use");
  } else {
    console.log("Nautilus is not available");
  }
} else {
  console.log("No wallet available");
}
```
<!-- prettier-ignore-end -->

## Request access

After making sure that the Nautilus Wallet is installed and running, now it's time to request access to the user's wallet. This is done by calling the `ergoConnector.nautilus.connect()` method, as shown below.

```ts
const connected = await ergoConnector.nautilus.connect(); // [!code focus]

if (connected) {
  console.log("Connected!");
} else {
  console.log("Not connected!");
}
```

The first time the `connect()` method is called, Nautilus will pop up and prompt the user to allow or deny access to your dApp. By default, it will return `false` if the user declines, otherwise, it will return `true` and globally inject the `ergo` object which you can use to interact with the [Context API](/dapp-connector/api-overview#context-api). For the subsequent calls, if the dApp is previously, the Nautilus pop-up prompt will be bypassed.

### Avoid globally instantiating of the `ergo` object

Sometimes we need to avoid instantiating the `ergo` object globally, especially when handling multiple wallets. To achieve this, follow these steps:

1. Call `ergoConnector.nautilus.connect({ createErgoObject: false })`. Calling the `connect()` method with the parameter `{ createErgoObject: false }` will request a connection with the user's wallet without automatically instantiating the `ergo` object.
2. Get the context object by calling the `ergoConnector.nautilus.getContext()` method.

```ts
const isConnected = await ergoConnector.nautilus.connect({ createErgoObject: false }); // [!code focus]
if (isConnected) {
  const ergo = await ergoConnector.nautilus.getContext(); // [!code focus]
}
```

### Check for authorization and connection status

Nautilus provides methods to check both the authorization and connection status of your dApp with the wallet.

- `ergoConnector.nautilus.isConnected()`: Checks if there is an active connection between your dApp and Nautilus.
- `ergoConnector.nautilus.isAuthorized()`: Checks if your dApp has been previously authorized by the user.

## Disconnect from the Wallet

You can disconnect from a wallet using the `ergoConnector.nautilus.disconnect()` method, which will revoke your dApp's authorization token. If you need to connect again in the future, the user will be prompted with a new connection request.
