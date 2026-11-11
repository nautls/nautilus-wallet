# Security model

What Nautilus protects, from whom, and the invariants a change must keep. Read this before
touching `src/common/keystore.ts`, `src/database/walletsDbService.ts`,
`src/database/unlockSession.ts`, `src/extension/background/` or anything that signs.

Each rule is stated first, then the code that enforces it and the spec that would fail if it
broke. If a name here no longer matches the code, fix the doc in the same change.

## Threats

In scope:

- **A malicious dApp or web page.** It can call the injected API with any arguments, as often
  as it likes.
- **A copy of the browser profile** (stolen disk, backup, sync). It holds every encrypted
  secret, so it can be brute-forced offline; the cost of that is set by the KDF.
- **A compromised renderer of a web page.** It can run code in our content script's isolated
  world, but not in extension pages or the service worker.

Out of scope: malware running as the user while the browser is open, other extensions with
`debugger` or similar access, a compromised build or dependency, and a user who approves a
request they didn't read.

Accepted risk: while an unlock session is active, anyone at the unlocked browser can sign with
a wallet on the master password without typing it. The timeout bounds this.

## Trust boundaries

| Context                                                | Trust     |
| ------------------------------------------------------ | --------- |
| Extension pages (popup, side panel, connector windows) | Trusted   |
| Service worker (`background.ts`)                       | Trusted   |
| Content scripts and the injected dApp API              | Untrusted |
| Web pages / dApps                                      | Untrusted |
| Anyone with a copy of the browser profile on disk      | Untrusted |

- dApps reach the wallet only through the content script, which forwards requests to the service
  worker. `isInternalEndpoint` drops messages sent from page context, but it lets content scripts
  through, so it is not a trust boundary on its own.
- dApp requests are scoped to the connection of their origin (`onMessageAuth`). The content
  script stamps the origin from `location.origin` and overwrites any origin the page sends
  (`contentScript.spec.ts`). A compromised renderer can still forge it, so the origin only
  identifies the dApp. It never authorizes anything.
- A dApp request never signs anything by itself. The service worker opens a connector window,
  and signing happens there, after the user confirms. The service worker never decrypts a
  secret.

## Storage

- **`storage.local`** holds the wallets, the encrypted secrets, the master key record, the
  session mask and the session settings. `background.ts` restricts it to `TRUSTED_CONTEXTS`
  where `setAccessLevel` supports it: Chrome 140 and later. On Firefox and older Chrome, content
  scripts can read it, so everything in it must be safe for a compromised renderer to see
  (`storage-access.spec.ts`, Chrome only).
- **`storage.session`** stays in memory and is cleared when the browser restarts or the extension
  updates. Content scripts can't read it by default on any supported browser, and nothing widens
  that.
- **IndexedDB (Dexie)** holds cached chain data only. Anything it loses must be refetchable or
  reconstructable from the chain. It can be evicted or cleared, so it holds no secrets and
  nothing that must persist. Exception: the deprecated `wallets` table, see
  [Known gaps](#known-gaps).
- **`localStorage` and `sessionStorage`** are never used. They don't exist in the service worker
  and aren't covered by the `TRUSTED_CONTEXTS` restriction.
- Never write a secret, password or usable key unencrypted to disk (`storage.local`, IndexedDB
  or anything else that persists). `storage.session` is in memory, but it still never holds a
  usable key on its own; see the split key below.

## Encryption (`src/common/keystore.ts`)

Specs: `tests/unit/keystore.spec.ts`.

- **v2 (current):** each secret is encrypted with its own random wallet key using AES-256-GCM,
  with the wallet's public key as associated data (AAD). The wallet key is wrapped in one of two
  ways:
  - by a key derived from the wallet's own password (PBKDF2-SHA256, 600k iterations, random
    16-byte salt), or
  - by the master key, which is itself wrapped by a key derived from the master password with
    AAD `nautilus:master-key`.
- The AAD strings and storage keys are part of the stored format. Changing one makes existing
  records unreadable.
- Every encryption uses a random 12-byte IV, and every derivation a random salt. Never reuse
  either.
- Passwords are NFKC-normalized before key derivation in v2. v1 records skip this, so they keep
  decrypting.
- **v1 (legacy):** CryptoJS AES-CBC, key derived with one round of MD5, no authentication. It is
  only read, never written. A successful `getSecret` re-encrypts the record as v2.
  `needsUpgrade` also flags password-wrapped v2 records whose iteration count is below the
  current one.
- Changing the master password re-wraps the same master key with a fresh salt and IV. Wallet
  secrets stay unchanged.

## Unlock session (`src/database/unlockSession.ts`)

Specs: `tests/unit/walletsDbService.spec.ts`, `tests/e2e/connector/unlock-session.spec.ts`.

While the session is active, wallets on the master password can sign without typing it again.

- **Split key.** The master key is kept in two halves: a random `mask` in `storage.local`, and
  `key XOR mask` in `storage.session`. A copy of only the disk or only the memory reveals
  nothing. A GCM-sealed `check` (AAD `nautilus:master-key-halves`) confirms the joined halves
  before they are used.
- **Binding.** Both halves share a random `id`. The in-memory half also carries a fingerprint of
  the master key record: its wrapping IV, which changes on every wrap. Re-wrapping the master
  key therefore ends the session.
- **One way in.** Every use of the session goes through `sessionMasterKey` in
  `walletsDbService.ts`. It unlocks only secrets wrapped by the master key, and
  `decryptSecretWithMasterKey` refuses any other. A wallet on its own password always needs
  that password.
- **Expiry is checked on every read.** `readUnlockSession` rejects a session idle for longer
  than its timeout, and any session when the timeout is `"off"`. The `alarms` expiry and the
  `idle` "locked" listener only clear the session on time. They can fire late or be missing
  (Firefox has no `idle`). The `systemLock` timeout is the exception, see
  [Known gaps](#known-gaps).
- **Only the user can extend it.** `touchUnlockSession` runs only when the session's master key
  is used: to sign, to add a wallet, or to move a wallet onto the master password. Each of these
  follows a user's click. Status reads (`isUnlocked`, `canUnlock`) and dApp requests must never
  extend it.
- **When it ends:**
  - `lock()`;
  - it has been idle longer than the timeout, or the timeout is shortened below its idle time;
  - the timeout is set to `"off"`;
  - with `systemLock`, the system locks;
  - the master password is set up, changed or reset;
  - the halves fail to join, don't match, or don't open the wallet's key;
  - the browser restarts or the extension updates (`storage.session` is cleared, and
    `clearStaleMask` removes the leftover mask on startup and install).

## Actions that always need a typed password

Even while a session is active:

- revealing the mnemonic (`getSecret`, which has no session path);
- moving a wallet from the master password to its own password. Moving one onto the master
  password takes that wallet's own password, which already opens it, so the session may wrap it;
- changing a wallet password, or setting up, changing or resetting the master password;
- signing with a wallet that uses its own password.

## Invariants for changes

1. Never let a dApp request decrypt, sign or extend the session without an explicit user
   agreement in an extension window. Don't auto-submit, and don't autofocus the approve button
   of a signing view.
2. Never let the service worker hold a decrypted secret or the master key in memory or in a
   global.
3. A new export or secret-revealing action needs a typed password, never the session.
4. Anything that changes or re-wraps the master key ends the session under `withLock`.
5. A new time limit is enforced when the value is read. A timer only clears the value early.
6. Never log secrets, passwords, keys or key halves. Log error objects only.
7. A new crypto scheme gets a new `version`, and older versions must still decrypt.
8. The session is checked when the user clicks sign, not when the request window opens. If it
   ended while the window was open, signing throws `SessionLockedError` and asks for the
   password. The UI's `unlocked` flag only decides whether to show the password field.
9. Fail closed. A missing connection, wallet or request, an empty proof or an unexpected error
   rejects the dApp request; nothing falls back to signing or to a success response. Closing the
   window refuses the request.
10. Anything stored in `storage.local` must stay safe if a content script reads it.
