# Decisions (ADR log, DRAFT)

**D-001 Sources not verified.** Competitor sites (Nutritics, Kafoodle), gov.uk FSA guidance, ICO and Expo documentation were not reachable from the build environment (only npm and GitHub). No competitor fact, regulatory conclusion, price or Expo behaviour from those sources is verified here. Everything depending on them is marked open.

**D-002 Monorepo and stack.** `packages/core` (pure TypeScript, all rules and tests), `apps/mobile` (Expo SDK 58, React 19.3, RN 0.88; versions taken from the installed `expo` bundled-module list), `e2e` (Playwright). Metro resolves NodeNext-style `./x.js` specifiers to the TypeScript sources (`metro.config.js`). Reused from the sibling AccessChain project.

**D-003 No server.** The brief proposes a managed backend; this build deliberately has none. Everything is local-first. A server is a separate, reviewed project: PostgreSQL, per-person authentication, private storage, durable jobs, region/subprocessor/cost documented first (not done).

**D-004 Simulated roles.** One phone plays every role through a visible switcher. Authorisation, tenant/site scoping, active-status and separation-of-duties are real and tested in core; identity is not.

**D-005 What "offline" means.** The app has no network at all, so it is always offline. The offline requirement is modelled as *write-down-now, check-later*: a queued receiving record is captured without checks, keeps the affected dishes UNRESOLVED and blocks routine publication, and is reconciled later (idempotently; flags if the approved specification changed since capture). This models what a synced build would need; it does not prove sync behaviour.

**D-006 Unknown is a state, not a default.** Specification answers default to UNKNOWN. Declarations aggregate across nested recipes: an allergen unknown anywhere and not declared elsewhere makes the dish UNRESOLVED. No override or data path converts unknown to "not declared".

**D-007 Three separate concepts.** Declared allergens, supplier precautionary statements and kitchen controls are separate fields end to end (data, aggregation, rendering). Controls are only ever entered by a person; changing them changes the publication basis but never the ingredient declaration.

**D-008 Immutability.** The committed state is deep-frozen after each command; commands run on a clone and are atomic. Specs, substitutions and publications have no edit API. Corrections are new revisions.

**D-009 Approval binding.** Approval carries the case version, the exact specification id and the impact digest. A changed recipe set, a different spec, or a concurrent change refuses the approval.

**D-010 Publication model.** One publication per site revision with three channel states. A "basis hash" of declarations, open reviews, queued records and kitchen controls is re-checked per channel publish. Channel adapters are injected (simulated here); a throwing adapter counts as failure. Older revisions cannot be published.

**D-011 Overrides.** Two kinds only: small-team separation-of-duties exception, and "publish unresolved dish with warning". Both named, reasoned (>=15 chars), scoped (site + person or dish), expiring (1-14 days, a design parameter). Neither can alter data; the second still prints UNRESOLVED.

**D-012 Barcode.** Typed entry with GTIN check-digit validation to catch typing slips. No camera (adds a permission and a native module; decide with evidence). Barcode only finds the product record.

**D-013 Storage and encryption.** Whole database serialised and sealed with XChaCha20-Poly1305 (`@noble/ciphers`), bound to account, item and version. Key in Keystore-backed secure store (native) or a non-extractable WebCrypto key in IndexedDB (web demo; weaker, documented). Ciphertext in a private app file (`expo-file-system`, no permission) or localStorage (web). No plaintext fallback: failure to open shows nothing. The composition needs independent cryptographic review.

**D-014 Zero Android permissions.** Even INTERNET, VIBRATE and SYSTEM_ALERT_WINDOW (normally added by tooling) are blocked in `app.json`; verified with `expo prebuild`. A release build does not need them for local-only operation. *If a real phone shows a problem caused by this, revisit.*

**D-015 Android edge-to-edge.** `react-native-safe-area-context` with all edges; `?insets=44,48` simulates system bars on web and an e2e test guards it (verified to fail without the fix; see SECURITY_TESTS.md). Learned the hard way on the sibling product's first phone test.

**D-016 UI approach.** Home with five big buttons and a to-do summary; no tab bar; one level of navigation; wizard steps; status chips with symbol + words; detail behind "Details"/"Allergens"; confirmation card before approve, publish, acknowledge, exception and erase; in-app Text size (Normal/Large/Extra large) plus the Android system font scale; demo controls behind "Demo options". Meaning is never colour alone.

**D-017 AI.** No AI extraction. If ever added: disclosed business-data processing design, human review of the original sheet mandatory, output as a schema-validated draft linked to its source, never inferring absence of allergens or cross-contact.

**D-018 Distribution.** GitHub Actions builds a debug-signed release APK (testing only) and a web export; pushes to `main` refresh the `latest-test-build` release with `IngredientAlert-test.apk`. No iOS build (needs an Apple developer account and signing). Not on the Play Store.

**D-019 What this repo does not decide.** Lawful bases, controller/processor roles, retention periods, supplier terms, DPIA outcome, claims wording, pricing (GBP 79-199 per site per month is unvalidated), and any food-safety conclusion.
