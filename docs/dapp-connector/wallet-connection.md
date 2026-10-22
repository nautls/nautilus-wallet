# Connecting to a Wallet

The first step in interacting with Nautilus is to request access to the user's wallet. This is done using the `ergoConnector` object, which is automatically injected into the page context by the Nautilus Wallet browser extension.

:::warning
**Work-in-Progress**: Non-reviewed text. You may find numerous writing errors throughout this guide.
:::

## Check if Nautilus is running

To check if the user has Nautilus Wallet installed and running, check for the presence of `window.ergoConnector` and then for `window.ergoConnector.nautilus`. Access it through `window` so that the check doesn't throw a `ReferenceError` when no wallet is installed.

<!-- prettier-ignore-start -->
```ts
if (window.ergoConnector) { // check if the Connection API is injected // [!code focus]
  if (window.ergoConnector.nautilus) { // check if Nautilus Wallet is available // [!code focus]
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

After making sure that Nautilus Wallet is installed and running, it's time to request access to the user's wallet. This is done by calling the `ergoConnector.nautilus.connect()` method, as shown below.

```ts
const connected = await ergoConnector.nautilus.connect(); // [!code focus]

if (connected) {
  console.log("Connected!");
} else {
  console.log("Not connected!");
}
```

The first time the `connect()` method is called, Nautilus will pop up and prompt the user to allow or deny access to your dApp. It returns `false` if the user declines; otherwise, it returns `true` and globally injects the `ergo` object, which you can use to interact with the [Context API](/dapp-connector/api-overview#context-api). On subsequent calls, if the dApp was previously authorized, the pop-up is skipped and `connect()` resolves to `true` right away.

### Avoid creating the global `ergo` object

Sometimes you may need to avoid creating the `ergo` object globally, especially when handling multiple wallets. To achieve this, follow these steps:

1. Call `ergoConnector.nautilus.connect({ createErgoObject: false })`. Calling the `connect()` method with the parameter `{ createErgoObject: false }` will request a connection with the user's wallet without creating the global `ergo` object.
2. Get the context object by calling the `ergoConnector.nautilus.getContext()` method.

```ts
const isConnected = await ergoConnector.nautilus.connect({ createErgoObject: false }); // [!code focus]
if (isConnected) {
  const ergo = await ergoConnector.nautilus.getContext(); // [!code focus]
}
```

`getContext()` rejects with a `Refused` [error](/dapp-connector/api-overview#errors) if `connect()` was not successfully called first.

### Check for authorization and connection status

Nautilus provides methods to check both the authorization and connection status of your dApp with the wallet. Both return a `Promise<boolean>`.

- `ergoConnector.nautilus.isAuthorized()`: checks if your dApp's origin has been previously authorized by the user.
- `ergoConnector.nautilus.isConnected()`: checks if `connect()` was successfully called in the current page, i.e., if the Context API is available.

Authorization persists across page reloads, but connection does not. After a reload, `isAuthorized()` returns `true` while `isConnected()` returns `false`. In that case, calling `connect()` restores the connection without prompting the user again.

```ts
if (await ergoConnector.nautilus.isAuthorized()) {
  await ergoConnector.nautilus.connect(); // no pop-up, the dApp is already authorized
}
```

## Disconnect from the Wallet

You can disconnect from the wallet using the `ergoConnector.nautilus.disconnect()` method, which revokes your dApp's authorization and removes the global `ergo` object. It returns `true` if the disconnection succeeded. If you need to connect again in the future, the user will be prompted with a new connection request.

```ts
await ergoConnector.nautilus.disconnect();
```

## Deprecated methods

For backward compatibility, Nautilus also injects the legacy `ergo_request_read_access()` and `ergo_check_read_access()` functions. They are deprecated and log a warning when called. Use `ergoConnector.nautilus.connect()` and `ergoConnector.nautilus.isConnected()` instead.
