# nautilus-wallet

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
