# Data flows (DRAFT)

There is no network in this build. The Android manifest requests **one permission, CAMERA** (barcode scan only) and not even INTERNET; this is asserted by a test and checked on the prebuilt manifest in CI. Every flow below is on-device.

```
Staff (signed in with a per-person PIN on the shared device)
   | typed entries (barcode, pack, batch, specification answers)
   v
Core engine (pure TypeScript, in memory)  <--- atomic commands, authorisation on every call
   | whole database serialised
   v
Vault: XChaCha20-Poly1305, key bound to account + item + version
   | ciphertext only
   +--> native: private app file (documentDirectory)    web demo: browser localStorage
   key:  native: Android Keystore-backed secure store   web demo: IndexedDB, wrapped by a non-extractable WebCrypto key
```

| # | Flow | Data | Where it goes | Notes |
|---|---|---|---|---|
| F1 | Receiving entry | product choice, typed barcode, pack, batch, delivery note, staff id | in-memory state, then encrypted at rest | Barcode is an identifier aid only. |
| F2 | Specification entry | supplier, version label, ingredient text, 14 x 2 allergen answers, evidence reference | same | Manual only. Evidence reference is a pointer, not an upload. |
| F3 | Review and approval events | staff ids, timestamps, spec/impact ids | audit trail (hash-chained) | Audit details contain ids, never names. |
| F4 | Publication snapshots | dish declarations, kitchen-control text | immutable records | In a real service, QR/web declarations are deliberately public. Here they are simulated. |
| F5 | Settings | text size, theme, auto-lock time, wrong-PIN counters, demo printer-failure switch | plain local file/localStorage | Non-secret. Counters hold a count and a time, not a PIN. |
| F8 | Camera barcode scan | camera frames, decoded in memory to a barcode number | the number fills the delivery form; **frames are not stored or sent** | Only after the person taps Scan and allows the camera. By design and manifest, not by an inspection of the camera module. |
| F9 | PIN | per-person salted scrypt hash | inside the sealed state | The PIN itself is never stored or logged. A hash of a 4-6 digit PIN can be brute-forced offline by someone who copies the file. |
| F10 | Unsent drafts | half-typed form text | sealed file `ia-drafts`, private to the person, cleared on submit, cancel or erase | |
| F6 | Export | source-linked history | shown on screen as text | No file or share sheet in this build; nothing leaves the phone. |
| F7 | Erase | everything | deleted from device (data file + key) | No backup exists, by design of this build. |

**What does not exist:** telemetry, analytics, crash reporting, advertising IDs, cloud AI/OCR, push notifications, location, contacts, microphone, diner profiles, worker photos or monitoring. An end-to-end test asserts that no request leaves the app's own origin.

## Future server design (NOT built; for review)
Managed PostgreSQL, managed authentication with per-person accounts and MFA/passkeys, private object storage, durable job queue, UK/EU region preference. The brief classes this as provider-managed encrypted **business** data: authorised server processes can read it, restricted and audited support access is required, and it must **never be described as owner-only or zero-knowledge**. Approved menu declarations are intentionally public. Suppliers, regions, subprocessors and operating costs have **not** been verified or quoted. Owner-private attachments (if ever added) would use on-device encryption instead.
