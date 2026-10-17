# Permissions (DRAFT)

## Android permissions
**None requested.** `app.json` blocks CAMERA, RECORD_AUDIO, location (fine/coarse/background), storage (read/write/media), INTERNET, VIBRATE and SYSTEM_ALERT_WINDOW. Verified by `npx expo prebuild --platform android` (every `uses-permission` carries `tools:node="remove"`), by a unit test on `app.json`, and by a CI step. Manual barcode entry is used on purpose; a camera scanner would add a permission and needs its own decision.

## Roles (enforced in `packages/core/src/permissions.ts`, tested)
| Action | Receiving operator | Specification reviewer | Publication approver | Service staff | Administrator |
|---|:-:|:-:|:-:|:-:|:-:|
| Read site data | yes | yes | yes | yes | yes |
| Record / queue / reconcile deliveries | yes | | | | |
| Check specification, review impact | | yes | | | |
| Reject a review | | yes | yes | | |
| Approve a change, end a substitution | | | yes | | |
| Add approved recipe version | | | yes | | |
| Prepare / publish a revision | | | yes | | |
| Acknowledge a revision | | | | yes | |
| Set kitchen controls | | | | | yes |
| Grant / revoke exceptions | | | | | yes |
| Add / offboard staff, remove personal details | | | | | yes (tenant-wide) |
| Export history | | | yes | | yes |

Rules: roles are held **per person** (no shared logins); a membership names a site or "*" (all sites of **that tenant only**); an offboarded person holds nothing; authorisation resolves the tenant from the target object, and a foreign or missing object returns the same error. A "limited support" role from the brief is **not built** (there is no server to support); head-office access is never automatic across tenants.

## Separation of duties
The person who **recorded the delivery** or **checked the specification** cannot approve a consequential change (different product, or any change to declarations, or an incomplete specification). Exception: an administrator may grant a **small-team exception** that is (a) for one named approver, (b) at one site, (c) backed by a written reason of at least 15 characters, (d) limited to 1-14 days (a design parameter, not a regulatory figure), (e) revocable, and (f) never grantable to oneself. The decision records which exception was used.

## Demo caveat
In this build one phone switches between personas, so these rules are enforced by software but not by real identity. That is why real staff logins need a server.
