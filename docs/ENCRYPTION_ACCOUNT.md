# Encryption: an accurate account

Scope: the 0.2.0 Android app (and the browser build used for tests). This describes the code in the repository. It has **not** been reviewed by an independent cryptographer, and the on-phone check below shows that the code runs, not that it is strong. Vague words such as "scrambled" are not used in the app or its documents (a search of the app source and the documents found none); this file is the exact statement.

## What is encrypted, with what
| Item | Detail |
|---|---|
| Algorithm | XChaCha20-Poly1305 (authenticated encryption, 256-bit key, 192-bit nonce) |
| Library | `@noble/ciphers` (JavaScript, runs inside the app's JavaScript engine; no native crypto module of our own) |
| What is sealed | The whole kitchen database: people, roles, products, specifications, recipes, deliveries, reviews, publications, acknowledgements, the audit trail, PIN verifiers (`ia-state.json`); unsent drafts (`ia-drafts.json`) |
| Nonce | A fresh random 24-byte value for every save, stored beside the ciphertext |
| Binding | The account name, the item name and the save counter are authenticated as associated data. A blob moved to another item or account, edited by one character, or opened with another key is refused (tested) |
| Recovery wrap | HKDF-SHA256 wrapping of the content key under a 256-bit recovery secret exists in code as a **design preview**. No backup is stored anywhere, so it restores nothing |
| PIN hashing | scrypt (N=4096, r=8, p=1) with a random 16-byte salt, from `@noble/hashes`. This is for checking a PIN, not for encrypting data. The PIN does not derive the data key |

## Keys
* **Generation:** 32 random bytes from the platform's secure random source (`crypto.getRandomValues`, which on Android is provided through `expo-crypto`; the app refuses to start if it is unavailable).
* **Storage:** `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. On Android this keeps the value encrypted under a key held in the Android Keystore, for this app only. Whether that Keystore key is hardware-backed depends on the phone and **was not checked**.
* **Not in backups:** `allowBackup` is off, and the secure-store backup rules exclude its data. Not tested by restoring a backup.
* **Not derived from a password or PIN.** Nobody, including the person who set the PIN, holds a key that decrypts the data.
* **Browser build (tests only):** the key sits in IndexedDB, wrapped by a non-extractable WebCrypto key. Weaker: any script in the page's origin can use it. It is not the product.

## What stays readable
| Where | What can be read without the key |
|---|---|
| App files | File names (`ia-state.json`, `ia-drafts.json`, `ia-settings.json`), their sizes (which reveal roughly how much data there is) and modification times |
| `ia-settings.json` | Text size, colour choice, auto-lock minutes, the demonstration printer switch, and the wrong-PIN counters (a count and a time per person id). Plain text by design; no names, no PIN |
| Screen | Everything the signed-in person is shown. The app does **not** block screenshots or the recent-apps thumbnail (`FLAG_SECURE` is not set), so decrypted content on screen can be captured by the person holding the phone or by screen recording |
| Logs | The app does not write kitchen data to logs. The emulator job records an excerpt of `logcat` filtered to the app and React Native errors; it is kept as evidence and has not been scanned for secrets |
| Backups | Nothing of the app's data is meant to be in Android backups; not tested |
| Notifications | None exist; the app sends none |
| Network | Nothing is sent; the app has no internet permission |

## Who can decrypt what
* **The app, on this phone, while it runs**: it reads the key from the Keystore-protected store, so anyone who can open the unlocked app can see what their signed-in role allows. The PIN only decides who the app believes is holding the phone.
* **Another app on the phone**: no, under Android's normal app separation.
* **Someone with root, a debugger on a debuggable build, or a forensic image taken with the key**: yes. Not tested or defended against.
* **Someone who copies only the files** (for example from an Android backup, if backups were on, or a stolen storage chip without the Keystore): they get ciphertext and cannot decrypt it without the Keystore key. They can, however, try every 4-6 digit PIN against the PIN hashes **only if they can also decrypt the state**, because the PIN verifiers live inside it.
* **GitHub, the build system, the developer**: no. No key or data leaves the phone; the key is created on first use on that phone.
* **A server operator**: there is no server.

## Limits (open)
* Rollback of the whole storage to an older copy is not detected: the save counter is stored next to the ciphertext.
* Loss of the key (new phone, cleared data, uninstall) loses the data permanently. There is no backup and no reset.
* No independent cryptographic or security review has taken place.

## "Check encryption on this phone" (Settings > About this build)
Runs the real vault code against the phone's real key storage with made-up text: it saves a temporary key and reads it back unchanged, encrypts text and checks the stored form does not contain it, opens it again, and confirms that a one-character change, a different item and a different key are each refused. It then deletes the temporary key. It shows none of the kitchen's data. A pass means this build can do those things on this phone. It does not measure strength, does not inspect your stored data, and says nothing about hardware backing. Core unit tests: `packages/core/test/selfcheck.test.ts`. Emulator flow: `android-tests/flows/12-encryption-check.yaml` (result in the report).
