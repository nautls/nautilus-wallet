<p align="center">
  <img alt="Nautilus" src="https://user-images.githubusercontent.com/96133754/196057495-45bcca0f-a4de-4905-85ea-fbcdead01b42.svg" width="150">
</p>

<h1 align="center">
  Nautilus Wallet
</h1>

<p align="center">
  <a href="https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai"><img src="https://badgen.net/chrome-web-store/v/gjlmehlldlphhljhpnlddaodbjjcchai?icon=chrome" alt="chrome web store published version"></a>
  <a href="https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai"><img src="https://badgen.net/chrome-web-store/stars/gjlmehlldlphhljhpnlddaodbjjcchai" alt="chrome web store rating"></a>
  <a href="https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai"><img src="https://badgen.net/chrome-web-store/users/gjlmehlldlphhljhpnlddaodbjjcchai" alt="chrome web store users"></a>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://addons.mozilla.org/pt-BR/firefox/addon/nautilus/"><img src="https://badgen.net/amo/v/nautilus?icon=firefox" alt="mozilla add-on published version"></a>
  <a href="https://addons.mozilla.org/pt-BR/firefox/addon/nautilus/"><img src="https://badgen.net/amo/stars/nautilus" alt="mozilla add-on rating"></a>
  <a href="https://addons.mozilla.org/pt-BR/firefox/addon/nautilus/"><img src="https://badgen.net/amo/users/nautilus" alt="mozilla add-on users"></a>
</p>

<blockquote align="center">
  <i>Built in secrecy, sourcing parts from unnamed sources. Roams the seas beyond the reach of land-based governments.</i>
</blockquote>

&nbsp;

## Description

Nautilus Wallet is a community-driven wallet built for the Ergo platform with a focus on privacy, security, and user experience.

- Easy to use
- Blazing fast
- Sandboxed NFT Gallery
- Ledger support
- Multi-wallet support
- dApp Connector

## Download and install

- [From Chrome Store](https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai)
- [From Firefox Store](https://addons.mozilla.org/pt-BR/firefox/addon/nautilus/)
- [From GitHub](https://github.com/nautls/nautilus-wallet/releases/latest)

# dApp Integration

- [Technical documentation](https://docs.nautiluswallet.com/)

## Project setup [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nautls/nautilus-wallet)

```
pnpm i
```

### Build and start in development mode

Development mode is currently only supported in Chrome due to [a bug in Firefox](https://bugzilla.mozilla.org/show_bug.cgi?id=1864284) that prevents scripts to be leaded from localhost.

```bash
# Mainnet
pnpm run dev:mainnet
```

```bash
# Testnet
pnpm run dev:testnet
```

### Build for production

```bash
# Mainnet for Chrome
pnpm run build:mainnet:chrome

# Mainnet for Firefox
pnpm run build:mainnet:firefox
```

```bash
# Testnet for Chrome
pnpm run build:testnet:chrome

# Testnet for Firefox
pnpm run build:testnet:firefox
```
