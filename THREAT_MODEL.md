# Threat model (DRAFT, lightweight)

Scope: the on-device app in this repository. A server threat model is required before any server exists. STRIDE-style summary; "Test" refers to SECURITY_TESTS.md.

| ID | Threat | Mitigation in this build | Residual / open |
|---|---|---|---|
| T1 | Someone with the unlocked phone reads kitchen data | Data encrypted at rest; key in Android Keystore-backed secure store (this-device-only) | The unlocked app shows data. Device lock is the user's control. Web demo has weaker key protection (documented). |
| T2 | Lost phone / lost key | Fails closed: ciphertext without key shows nothing | Data permanently unrecoverable; no backup in this build. Recovery secret is a design preview only. |
| T3 | Tampering with stored data | AEAD with account/item/version binding; tampering and rollback fail to open | Does not stop a user wiping everything. |
| T4 | Staff acts beyond role | Authorisation inside core on every command; tenant, site, role, active status | Personas are simulated on one phone: whoever holds the phone can switch persona. Real separation needs a server. |
| T5 | Receiving operator approves own change | Separation-of-duties check; only named, reasoned, scoped, expiring exception | The exception is a human risk acceptance. |
| T6 | Unknown data presented as safe | Unknown propagates to UNRESOLVED; no "free from"; override cannot clear it; property test over random specs | Data-entry error (a typed "not declared" that is wrong) cannot be detected by software. Reviewer must check the original sheet. |
| T7 | Barcode trusted as formulation | Identifier match only; pack, batch, version compared | Supplier can change recipe without changing barcode or label version. |
| T8 | Publication bypasses a pending review | Basis hash re-check at publish; prepare blocked while reviews/queued records exist | |
| T9 | Replay of an approval or publication request | Idempotency keys; approval bound to spec revision + impact digest + case version | |
| T10 | Simultaneous reviewers | Optimistic version check; second submission refused | |
| T11 | Stale channel mistaken for current | Per-channel revision and status; stale/failed channels outstanding; printed-copy revision check; service view labelled OLD | Physical printed copies can still be on walls; process, not software. |
| T12 | Acknowledgement over-read | Bound to exact revision; text says receipt only | Not training; not understanding. |
| T13 | Cross-tenant access | Every command resolves tenant from the resource; same error for "missing" and "not yours" | In-process only; server enforcement and tests are required later. |
| T14 | Departing staff retain access | Offboarding ends memberships, lapses their exceptions | Same-phone caveat. |
| T15 | Audit tampering | Hash chain | Tamper-evident, not tamper-proof; a hash chain does not prove an event really happened. |
| T16 | Malicious/garbage input | Typed fields are validated (barcode check digit, required fields); all rendering is plain text | No parsing of uploaded files exists. Fuzzing not done. |
| T17 | Supply-chain (npm) | Lockfile; versions from the Expo SDK list | No SBOM or vulnerability review done. `npm audit` not reviewed. |
| T18 | Debug-signed APK sideloaded | Documented as testing only | Not signed for release; not on Play Store. |
| T19 | Over-claiming | Visible notices; docs list limits; tests assert no "free from"/"safe" wording in stored publications | Wording needs specialist review. |

Out of scope / not assessed: physical stock handling, cross-contact on the line, supplier fraud, real-device attacks (root, backups), accessibility with assistive technology on a real phone.
