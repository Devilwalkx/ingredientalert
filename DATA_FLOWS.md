# Data flows (DRAFT)

There is no network in this build. The Android manifest requests **no permissions at all** (not even INTERNET); this is asserted by a test and checked with `expo prebuild` in CI. Every flow below is on-device.

```
Staff (simulated persona)
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
| F5 | Settings | text size, demo printer-failure switch | plain local file/localStorage | Non-secret. |
| F6 | Export | source-linked history | shown on screen as text | No file or share sheet in this build; nothing leaves the phone. |
| F7 | Erase | everything | deleted from device (data file + key) | No backup exists, by design of this build. |

**What does not exist:** telemetry, analytics, crash reporting, advertising IDs, cloud AI/OCR, push notifications, camera, location, contacts, diner profiles, worker photos or monitoring. An end-to-end test asserts that no request leaves the app's own origin.

## Future server design (NOT built; for review)
Managed PostgreSQL, managed authentication with per-person accounts and MFA/passkeys, private object storage, durable job queue, UK/EU region preference. The brief classes this as provider-managed encrypted **business** data: authorised server processes can read it, restricted and audited support access is required, and it must **never be described as owner-only or zero-knowledge**. Approved menu declarations are intentionally public. Suppliers, regions, subprocessors and operating costs have **not** been verified or quoted. Owner-private attachments (if ever added) would use on-device encryption instead.
