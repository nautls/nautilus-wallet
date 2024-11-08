# Connecting to a Wallet

The first step in interacting with Nautilus is to request the access to the user. This is done using the `ergoConnector` object, which is automatically injected into the page context by the Nautilus Wallet web extension.

:::warning
**Work-in-Progress**: Non-reviewed text. You may find numerous writing errors throughout this guide.
:::

## Check if Nautilus is running

To check if the user has the Nautilus Wallet installed and running, check for the presence of the `ergoConnector` and then for `ergoConnector.nautilus`.

<!-- prettier-ignore-start -->
```ts
if (ergoConnector) { // check if Connection API is injected // [!code focus]
  if (ergoConnector.nautilus) { // check if Nautilus Wallet is available // [!code focus]
    console.log("Nautilus Wallet is ready to use");
  } else {
    console.log("Nautilus Wallet is not active");
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

The first time the `ergoConnector.nautilus.connect()` method is called, Nautilus will pop up and prompt the user to allow or deny access to your dApp. By default, it will return `false` if the user declines, otherwise, it will return `true` and globally inject the `ergo` object which you can use to interact with the [Context API](/dapp-connector/api-overview#context-api). For the subsequent calls, if the dApp is previously authorized, the Nautilus pop-up prompt will be bypassed.

### Avoid global instantiation of the `ergo` object

### Check if your dApp is authorized

### Check if your dApp is connected

## Disconnect from the Wallet
