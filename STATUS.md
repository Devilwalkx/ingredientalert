# IngredientAlert - Status (DRAFT)

## First real-phone result
**None yet.** The app has never been installed on a physical phone. On the sibling AccessChain app the first phone test found Android system bars covering the UI; the same guard (react-native-safe-area-context with all edges, plus a simulated-insets e2e test) is built in here but **not confirmed on a phone**.

## Implemented
- Core (pure TypeScript): tenants/sites/staff/role memberships; approved product identities with revisioned specification evidence; receiving with mismatch detection (unknown/invalid barcode with check digit, other product, pack, version label, batch, incomplete spec, spec changed since capture); duplicate-entry handling; write-down-now/check-later queue with idempotent reconciliation; review workflow with optimistic versions; information hold; 14 UK allergens with declared / precautionary / kitchen-control kept separate; unknown-propagating declarations over nested recipes with site applicability, impact preview, cycle and stale-reference detection; precise-revision approval bound to impact digest; separation of duties with named/reasoned/scoped/expiring exceptions; per-channel publication with idempotent retry, partial failure, stale/superseded handling, printed-copy check; revision-bound acknowledgement; offboarding; staff erasure with justified audit retention; hash-chained audit; source-linked history export (active vs stale menus); encrypted local state vault (XChaCha20-Poly1305).
- App (Expo, Android + web): Home with to-do cards and five big buttons, guided delivery flow, review/approve flow, publish flow, service view with acknowledgement, settings/privacy/manager tools, About, Demo options (role switcher, demo helpers), in-app text size, confirmation card before consequential actions, safe-area handling, zero Android permissions.
- CI workflow and always-newest GitHub release.

## Tested (automated)
- **61 unit tests** (Vitest, `packages/core`): declarations (incl. 300-case property test), receiving, offline queue, workflow, overrides, publication, acknowledgement, security, whole-chain demo.
- **17 browser tests x 3 viewports (Pixel 7, 390 px, 320 px) = 51 passing locally**: full sauce demo through the failed printed-menu update, encrypted storage, lost key fails closed, erase, no third-party requests, keyboard, installable manifest, axe WCAG 2 A/AA scan on every screen state, no overflow/overlap/text-outside-button on every screen at normal, 2x (`?fontscale=2`) and in-app Extra large text, simulated Android insets.
- `expo prebuild` verified: every `uses-permission` is removed (zero permissions requested).
- Screenshots were reviewed (home, impact, publish-failed, 320 px at 2x text). At 2x text on a 320 px screen the layout is cramped but nothing overlaps or overflows.

## Mutation checks (safeguard broken on purpose; tests failed; restored)
| Break | Result |
|---|---|
| Separation-of-duties check disabled | 3 tests failed |
| Unknown contains-answers ignored (treated as not declared) | 2 tests failed (incl. property test) |
| Cycle check disabled | 1 test failed |
| Publication basis (pending-review) check disabled | 1 test failed |
| Acknowledgement revision binding disabled | 1 test failed |
| Safe-area edges removed (system bars cover UI) | insets e2e failed |
| Button text wrapping removed (`numberOfLines={1}`) | 2x-text e2e failed (text overflow) |

## Bugs found while building
- Test fault: an acknowledgement test reused staff who had already acknowledged revision 1 (fixed with a new person).
- Port clash: another local project served on the e2e default port; e2e uses its own port.
- A11y: Home buttons' names did not contain their visible text (axe `label-content-name-mismatch`) and emoji leaked into names; fixed.
- Layout: allergen answer buttons overflowed at 2x text on narrow screens; stacked full width.

## Simulated
Staff identities (one phone, role switcher); channel adapters (QR/web, service view, printed menu; printer failure is a demo switch); all data and people; the passage of time (demo clock).

## Externally reviewed
**Nothing.** No food-safety, privacy, security, cryptography or accessibility review (with disabled users or assistive tech on a device) has taken place.

## Blocked / not verified / not built
| Item | Why |
|---|---|
| Competitor facts (Nutritics, Kafoodle), FSA guidance, ICO guidance incl. Data (Use and Access) Act 2025 | Sites unreachable from the build environment; nothing was verified |
| Real device behaviour (install, Keystore, file storage, fonts, insets) | No device available |
| Server, authentication, sync, shared data | Not built (out of scope); real staff logins need a server |
| Barcode camera scanning | Deliberately not added (permission + native module) |
| AI extraction of specification sheets | Not built; disclosed future option needing a reviewed design |
| Supplier feeds / integrations / outage handling | No API contracts exist; not invented |
| iOS build | Needs Apple developer account and signing |
| DPIA, lawful basis, processor terms, retention periods, incident procedure | Open (PRIVACY_REGISTER.md, RETENTION.md) |
| Pilot (3 kitchens) and pricing test (GBP 79-199 per site per month, unvalidated) | Needs customers |
| Dependency/`npm audit` review, SBOM | Not done |

## Next steps
1. Install on a real Android phone and report problems (GETTING_STARTED.md).
2. Shadow a real receiving process on paper with a kitchen manager before any software pilot.
3. Specialist food-safety and privacy review of wording, workflow and data handling.
4. Decide on a server design only if the shadow test shows the gap is real.
