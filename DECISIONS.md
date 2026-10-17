# Decisions (ADR log, DRAFT)

**D-001 Sources not verified.** Competitor sites (Nutritics, Kafoodle), gov.uk FSA guidance, ICO and Expo documentation were not reachable from the build environment (only npm and GitHub). No competitor fact, regulatory conclusion, price or Expo behaviour from those sources is verified here. Everything depending on them is marked open.

**D-002 Monorepo and stack.** `packages/core` (pure TypeScript, all rules and tests), `apps/mobile` (Expo SDK 58, React 19.3, RN 0.88; versions taken from the installed `expo` bundled-module list), `e2e` (Playwright). Metro resolves NodeNext-style `./x.js` specifiers to the TypeScript sources (`metro.config.js`). Reused from the sibling AccessChain project.

**D-003 No server.** The brief proposes a managed backend; this build deliberately has none. Everything is local-first. A server is a separate, reviewed project: PostgreSQL, per-person authentication, private storage, durable jobs, region/subprocessor/cost documented first (not done).

**D-004 Roles and identity.** *Superseded in part by D-021.* Authorisation, tenant/site scoping, active-status and separation-of-duties are real and tested in core. Identity was originally a simulated switcher on one phone; it is now a per-person PIN sign-in on a shared device (D-021), and the switcher survives only as labelled demonstration behaviour in the example kitchen.

**D-005 What "offline" means.** The app has no network at all, so it is always offline. The offline requirement is modelled as *write-down-now, check-later*: a queued receiving record is captured without checks, keeps the affected dishes UNRESOLVED and blocks routine publication, and is reconciled later (idempotently; flags if the approved specification changed since capture). This models what a synced build would need; it does not prove sync behaviour.

**D-006 Unknown is a state, not a default.** Specification answers default to UNKNOWN. Declarations aggregate across nested recipes: an allergen unknown anywhere and not declared elsewhere makes the dish UNRESOLVED. No override or data path converts unknown to "not declared".

**D-007 Three separate concepts.** Declared allergens, supplier precautionary statements and kitchen controls are separate fields end to end (data, aggregation, rendering). Controls are only ever entered by a person; changing them changes the publication basis but never the ingredient declaration.

**D-008 Immutability.** The committed state is deep-frozen after each command; commands run on a clone and are atomic. Specs, substitutions and publications have no edit API. Corrections are new revisions.

**D-009 Approval binding.** Approval carries the case version, the exact specification id and the impact digest. A changed recipe set, a different spec, or a concurrent change refuses the approval.

**D-010 Publication model.** One publication per site revision with three channel states. A "basis hash" of declarations, open reviews, queued records and kitchen controls is re-checked per channel publish. Channel adapters are injected (simulated here); a throwing adapter counts as failure. Older revisions cannot be published.

**D-011 Overrides.** Two kinds only: small-team separation-of-duties exception, and "publish unresolved dish with warning". Both named, reasoned (>=15 chars), scoped (site + person or dish), expiring (1-14 days, a design parameter). Neither can alter data; the second still prints UNRESOLVED.

**D-012 Barcode.** *Updated by D-020.* GTIN check-digit validation catches typing and misreading slips. A barcode only finds the product record; it is never evidence of what is in the pack.

**D-013 Storage and encryption.** Whole database serialised and sealed with XChaCha20-Poly1305 (`@noble/ciphers`), bound to account, item and version. Key in Keystore-backed secure store (native) or a non-extractable WebCrypto key in IndexedDB (web demo; weaker, documented). Ciphertext in a private app file (`expo-file-system`, no permission) or localStorage (web). No plaintext fallback: failure to open shows nothing. The composition needs independent cryptographic review.

**D-014 Android permissions.** *Updated by D-020: CAMERA is now the one permission, used only for the barcode scan.* Everything else is blocked. Originally zero permissions. Even INTERNET, VIBRATE and SYSTEM_ALERT_WINDOW (normally added by tooling) are blocked in `app.json`; verified with `expo prebuild`. A release build does not need them for local-only operation. *If a real phone shows a problem caused by this, revisit.*

**D-015 Android edge-to-edge.** `react-native-safe-area-context` with all edges; `?insets=44,48` simulates system bars on web and an e2e test guards it (verified to fail without the fix; see SECURITY_TESTS.md). Learned the hard way on the sibling product's first phone test.

**D-016 UI approach.** *Replaced by D-022.* (Original: Home with five big buttons and a to-do summary; no tab bar; one level of navigation; wizard steps; status chips with symbol + words; detail behind "Details"/"Allergens"; confirmation card before approve, publish, acknowledge, exception and erase; in-app Text size (Normal/Large/Extra large) plus the Android system font scale; demo controls behind "Demo options". Meaning is never colour alone.)

**D-017 AI.** No AI extraction. If ever added: disclosed business-data processing design, human review of the original sheet mandatory, output as a schema-validated draft linked to its source, never inferring absence of allergens or cross-contact.

**D-018 Distribution.** GitHub Actions builds a debug-signed release APK (testing only) and a web export; pushes to `main` refresh the `latest-test-build` release with `IngredientAlert-test.apk`. No iOS build (needs an Apple developer account and signing). Not on the Play Store.

**D-019 What this repo does not decide.** Lawful bases, controller/processor roles, retention periods, supplier terms, DPIA outcome, claims wording, pricing (GBP 79-199 per site per month is unvalidated), and any food-safety conclusion.

**D-020 Camera barcode scanning, one permission.** `expo-camera` (`CameraView`, barcode types EAN-13, EAN-8, UPC-A, ITF-14). CAMERA is asked for only when the person taps Scan, after a plain-words reason; denial and permanent denial are explained with a route to system settings; there is a torch switch; a 20-second timeout and a misread (failed check digit) both offer retry and typing; manual search by name, supplier or number is always available. The microphone is not requested (`recordAudioAndroid: false`). Images are not stored or sent. Scan reliability on real packs is **NOT TESTED**; an emulator shows a virtual scene only. Rejected alternatives: a web-view scanner (more attack surface, worse permission handling) and a separate scanning service (needs a network).

**D-021 Shared-device sessions.** Per-person PIN, quick switch, auto-lock, step-up for consequential acts, throttling. Details, limits and open decisions: docs/SHARED_DEVICE_SESSIONS.md. A PIN is attribution, not encryption.

**D-022 UI approach (replaces D-016).** Decision-first screens: Home holds three tasks (Check a delivery, Review substitutions, Outstanding decisions and publication updates) plus "Status now"; bottom navigation (Home, Delivery, Review, Updates); a lock icon and Settings in the app bar; system Back unwinds a step, then goes home. Design tokens are unit-tested for contrast in light and dark. Status is icon plus words. The Android system font scale is honoured and an in-app text size multiplies on top. Per-screen reasoning: docs/SCREEN_DECISIONS.md.

**D-023 Status vocabulary.** Five words, each meaning one thing: Awaiting specification; Awaiting review; Approved revision; Publication incomplete; Staff acknowledgement outstanding (`packages/core/src/status.ts`, tested). A rejected review is "Not approved", never "Approved". Approval is not publication; a notification (none exist) is not an acknowledgement; an acknowledgement is not understanding.

**D-024 Own kitchen versus example.** A real kitchen starts empty (kitchen name, first person with a PIN). People, products with their specification evidence, and recipes are added in Settings. Catalogue entries are attributable (audit) and need evidence, but have no second-person check; a *substitution* still has the full review. Whether catalogue entries should also need a second person is open. The example kitchen is flagged `synthetic`, never mixed with a real one, and is the only place demonstration tools exist.

**D-025 Publication is simulated.** There is no server, so the QR / web menu and the printer cannot be reached. The UI labels both "(simulated)" and says "There is no server". The service view is the one place that is real in the sense that it shows the stored revision on this device.

**D-026 Identity and distribution.** Application id `app.devilwalkx.ingredientalert`, version 0.2.0, versionCode from the CI run number, commit and build time injected through `app.config.js` and shown in Settings > About this build. The id changed from a placeholder, so Android treats the new app as a different one: uninstall the old build first (its example data is lost). Signed with the public Android debug key (test signing). A private release key is an open owner decision.

**D-027 Encryption wording and self-check.** The app and documents state the library, algorithm, key handling and limits (docs/ENCRYPTION_ACCOUNT.md); Settings > About this build has "Check encryption on this phone" which runs the real vault and key store on made-up text. It shows the code runs on this phone; it does not show strength or hardware backing.

**D-028 Release signing is prepared, not switched on.** Secrets-driven signing, an APK identity record per build and a test that Android refuses a differently signed APK are in place. No private key exists; creating, backing up and adding it is the owner's step (docs/SIGNING.md).
