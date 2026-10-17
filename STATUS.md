# IngredientAlert: status (DRAFT)

Version 0.2.0. Details of the Android quality pass, with evidence and what is NOT tested: [docs/ANDROID_PASS_REPORT.md](docs/ANDROID_PASS_REPORT.md).

## Physical phone
**Never run on a physical phone.** Android evidence comes only from an emulator in GitHub Actions (see the report for the run). Real-world barcode scanning: **NOT TESTED**. TalkBack: **NOT TESTED**. Fresh-user usability sessions: **NOT RUN** (plan: docs/USABILITY_SESSION_PLAN.md).

## Implemented
- Core (pure TypeScript): tenants/sites/staff/roles; approved products with revisioned specification evidence; receiving with mismatch detection; duplicate handling; write-down-now/check-later queue; review workflow with optimistic versions; 14 UK allergens with *contains*, *supplier precautionary* and *kitchen procedures* kept separate; unknown-propagating declarations over nested recipes; approval bound to the exact revision and impact digest; separation of duties with named, reasoned, expiring exceptions; per-channel publication with retry and stale handling; revision-bound acknowledgement; offboarding; staff erasure with justified audit retention; hash-chained audit; encrypted state vault. **New in 0.2.0:** per-person PIN (salted scrypt) with throttle and reset; five-word status vocabulary; ordered-vs-arrived comparison; affected-scope calculation; product search; catalogue entry (`addProduct`); own-kitchen creation.
- App (Expo, Android + web): Home with three tasks (Check a delivery, Review substitutions, Outstanding decisions and publication updates) and "Status now"; delivery flow with **camera barcode scan** (expo-camera, permission in context, denial and permanent-denial handling, torch, timeout and misread recovery), manual search and typed entry; side-by-side comparison; review with affected recipes/sites/places and three separate allergen groups; publication updates (labelled simulated); service menu with per-person acknowledgement; **PIN sign-in, auto-lock and step-up PIN** on a shared device; own-kitchen setup (people, products, recipes); light and dark; text size on top of the Android font scale; build identity in Settings > About this build.

## Simulated or missing (said in the app)
No server. The QR / web menu and the printer are simulated. No notifications are sent (and the notification permission is not requested). The example kitchen's people have no PINs. Staff identity is a PIN on a shared device, not an account. No backup or recovery of data. No iOS build. No supplier feeds or AI reading of specification sheets.

## Automated tests (what they are; see the report for results and limits)
Core unit tests (Vitest), mobile unit tests (design tokens, scan result handling), 27 browser tests x 3 viewports (Pixel 7, 390 px, 320 px; port 4421), an emulator job running Maestro flows on API 36 and API 29 in GitHub Actions. They do not establish scan reliability, physical-device behaviour, assistive-technology use or security.

## Not externally reviewed
Food safety, privacy, security, cryptography, accessibility: nothing has been reviewed by a specialist.

## Blocked / open
| Item | Why |
|---|---|
| Competitor facts, FSA and ICO guidance | Sites unreachable from the build environment; nothing verified |
| Physical device behaviour (install, Keystore, camera, insets, PIN timing) | No device available |
| Server, accounts, sync, real publication | Not built |
| Private release key | Owner decision; test builds use the public Android debug key |
| DPIA, lawful basis, retention periods, incident procedure | Open (PRIVACY_REGISTER.md, RETENTION.md) |
| Pilot and pricing | Needs customers |
