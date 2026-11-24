# nautilus-wallet

## 2.0.0

### Major Changes

- Add master password support. Each wallet can use it or keep its own password. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Add persistent sessions with a configurable timeout. Wallets that use the master password can sign without retyping it until the session times out. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!

### Minor Changes

- Show the wallet balance in ERG when no fiat rate is available, instead of zero. ([#410](https://github.com/nautls/nautilus-wallet/pull/410)) Thanks [@arobsn](https://github.com/arobsn)!
- Support signing transactions with ErgoTree v3 contracts. These transactions are checked by the configured GraphQL server before they're returned or submitted; Ledger and partial signing don't support them yet. ([#412](https://github.com/nautls/nautilus-wallet/pull/412)) Thanks [@arobsn](https://github.com/arobsn)!
- Flag insecure dApp origins on connector requests. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Upgrade wallet secret encryption. Existing wallets are upgraded on their next unlock. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Localize number and currency formatting. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Add multi-recipient transactions. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Add the Native Tokens app for minting and burning tokens. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Add a password strength meter when creating or changing a password. ([`562640f`](https://github.com/nautls/nautilus-wallet/commit/562640fd7b747dd30f46e3ff40d724c20394f641)) Thanks [@arobsn](https://github.com/arobsn)!
- Remove the Buy ERG button from the assets view. ([#414](https://github.com/nautls/nautilus-wallet/pull/414)) Thanks [@arobsn](https://github.com/arobsn)!
- Group related settings under clear headings. ([#403](https://github.com/nautls/nautilus-wallet/pull/403)) Thanks [@arobsn](https://github.com/arobsn)!
- Delay enabling sign buttons on dApp requests to prevent accidental or lured approvals. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Let dApps choose which address signs each input with `ergo.sign_tx(tx, { signers })`, for Ledger wallets and ErgoTree v3 transactions. ([#412](https://github.com/nautls/nautilus-wallet/pull/412)) Thanks [@arobsn](https://github.com/arobsn)!
- Refresh the interface with a new color palette and redesigned views. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Add an option to re-sync a wallet. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!

### Patch Changes

- Stop balances from flickering when switching wallets. ([#415](https://github.com/nautls/nautilus-wallet/pull/415)) Thanks [@arobsn](https://github.com/arobsn)!
- Align the wallet balance to the left and make the master password prompt more compact. ([#410](https://github.com/nautls/nautilus-wallet/pull/410)) Thanks [@arobsn](https://github.com/arobsn)!
- Fix the backup alert flickering when switching wallets. ([`562640f`](https://github.com/nautls/nautilus-wallet/commit/562640fd7b747dd30f46e3ff40d724c20394f641)) Thanks [@arobsn](https://github.com/arobsn)!
- Fix the Banxa link on the Buy ERG button. ([`562640f`](https://github.com/nautls/nautilus-wallet/commit/562640fd7b747dd30f46e3ff40d724c20394f641)) Thanks [@arobsn](https://github.com/arobsn)!
- Speed up forms that handle asset amounts. ([#409](https://github.com/nautls/nautilus-wallet/pull/409)) Thanks [@arobsn](https://github.com/arobsn)!
- Harden the dApp connector against pages that try to act for another origin. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Use consistent wording and capitalization across the interface. ([#401](https://github.com/nautls/nautilus-wallet/pull/401)) Thanks [@arobsn](https://github.com/arobsn)!
- Fix the drawer close button ignoring clicks while an empty password field has focus. ([#406](https://github.com/nautls/nautilus-wallet/pull/406)) Thanks [@arobsn](https://github.com/arobsn)!
- Rewrite form error messages and link them to their fields for screen readers. ([#401](https://github.com/nautls/nautilus-wallet/pull/401)) Thanks [@arobsn](https://github.com/arobsn)!
- Show hidden amounts the same way on every screen. ([#410](https://github.com/nautls/nautilus-wallet/pull/410)) Thanks [@arobsn](https://github.com/arobsn)!
- Add HNS token icon. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Use WebHID as the default Ledger transport. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Fix the interface briefly showing the default language on open. ([`562640f`](https://github.com/nautls/nautilus-wallet/commit/562640fd7b747dd30f46e3ff40d724c20394f641)) Thanks [@arobsn](https://github.com/arobsn)!
- Use the minimum box value for Babel fee token-only outputs. ([#398](https://github.com/nautls/nautilus-wallet/pull/398)) Thanks [@arobsn](https://github.com/arobsn)!
- Fix balances and theme briefly showing defaults when the popup opens. ([`9dbc904`](https://github.com/nautls/nautilus-wallet/commit/9dbc90459dcd6f769e7809bc9de22b70d1eb4197)) Thanks [@arobsn](https://github.com/arobsn)!
- Stop offering to consolidate or optimize read-only wallets, which can't sign the transaction. ([#410](https://github.com/nautls/nautilus-wallet/pull/410)) Thanks [@arobsn](https://github.com/arobsn)!
- Show SigmaUSD swap errors under the amount they apply to. ([#401](https://github.com/nautls/nautilus-wallet/pull/401)) Thanks [@arobsn](https://github.com/arobsn)!
- Restyle the SigmaUSD app to match the rest of the wallet. ([`562640f`](https://github.com/nautls/nautilus-wallet/commit/562640fd7b747dd30f46e3ff40d724c20394f641)) Thanks [@arobsn](https://github.com/arobsn)!
- Show keyboard focus on tab panels. ([#410](https://github.com/nautls/nautilus-wallet/pull/410)) Thanks [@arobsn](https://github.com/arobsn)!
- Fix the unreadable demurrage warning text and give every wallet alert the same compact actions. ([#410](https://github.com/nautls/nautilus-wallet/pull/410)) Thanks [@arobsn](https://github.com/arobsn)!
- Fix wallet header resizing when the popup opens. ([`f9031df`](https://github.com/nautls/nautilus-wallet/commit/f9031dfdb3ece305dcbb9d51111606968743fb1b)) Thanks [@arobsn](https://github.com/arobsn)!
- Fix the wallet staying in a loading state when it fails to load. ([`562640f`](https://github.com/nautls/nautilus-wallet/commit/562640fd7b747dd30f46e3ff40d724c20394f641)) Thanks [@arobsn](https://github.com/arobsn)!

## 2.0.0-beta.3

### Minor Changes

- Support signing transactions with ErgoTree v3 contracts. These transactions are checked by the configured GraphQL server before they're returned or submitted; Ledger and partial signing don't support them yet. ([#412](https://github.com/nautls/nautilus-wallet/pull/412)) Thanks [@arobsn](https://github.com/arobsn)!
- Remove the Buy ERG button from the assets view. ([#414](https://github.com/nautls/nautilus-wallet/pull/414)) Thanks [@arobsn](https://github.com/arobsn)!
- Let dApps choose which address signs each input with `ergo.sign_tx(tx, { signers })`, for Ledger wallets and ErgoTree v3 transactions. ([#412](https://github.com/nautls/nautilus-wallet/pull/412)) Thanks [@arobsn](https://github.com/arobsn)!

## 2.0.0-alpha.2

### Minor Changes

- 6ff9d97: Show the wallet balance in ERG when no fiat rate is available, instead of zero.

### Patch Changes

- 6ff9d97: Align the wallet balance to the left and make the master password prompt more compact.
- 6ff9d97: Show hidden amounts the same way on every screen.
- 6ff9d97: Stop offering to consolidate or optimize read-only wallets, which can't sign the transaction.
- 6ff9d97: Show keyboard focus on tab panels.
- 6ff9d97: Fix the unreadable demurrage warning text and give every wallet alert the same compact actions.

## 2.0.0-alpha.1

### Patch Changes

- 148fa8f: Speed up forms that handle asset amounts.
- 13eb2fc: Fix the drawer close button ignoring clicks while an empty password field has focus.
- 9dbc904: Fix balances and theme briefly showing defaults when the popup opens.
- f9031df: Fix wallet header resizing when the popup opens.

## 2.0.0-alpha.0

### Major Changes

- 46dbd6f: Add master password support. Each wallet can use it or keep its own password.
- 46dbd6f: Add persistent sessions with a configurable timeout. Wallets that use the master password can sign without retyping it until the session times out.

### Minor Changes

- 46dbd6f: Flag insecure dApp origins on connector requests.
- 46dbd6f: Upgrade wallet secret encryption. Existing wallets are upgraded on their next unlock.
- 46dbd6f: Localize number and currency formatting.
- 46dbd6f: Add multi-recipient transactions.
- 46dbd6f: Add the Native Tokens app for minting and burning tokens.
- 562640f: Add a password strength meter when creating or changing a password.
- baa7e71: Group related settings under clear headings.
- 46dbd6f: Delay enabling sign buttons on dApp requests to prevent accidental or lured approvals.
- 46dbd6f: Refresh the interface with a new color palette and redesigned views.
- 46dbd6f: Add an option to re-sync a wallet.

### Patch Changes

- 562640f: Fix the backup alert flickering when switching wallets.
- 562640f: Fix the Banxa link on the Buy ERG button.
- 46dbd6f: Harden the dApp connector against pages that try to act for another origin.
- 4082efe: Use consistent wording and capitalization across the interface.
- 5f39237: Rewrite form error messages and link them to their fields for screen readers.
- 46dbd6f: Add HNS token icon.
- 46dbd6f: Use WebHID as the default Ledger transport.
- 562640f: Fix the interface briefly showing the default language on open.
- 46dbd6f: Use the minimum box value for Babel fee token-only outputs.
- 5582195: Show SigmaUSD swap errors under the amount they apply to.
- 562640f: Restyle the SigmaUSD app to match the rest of the wallet.
- 562640f: Fix the wallet staying in a loading state when it fails to load.
