# Security and safeguard tests (DRAFT)

"Automated" = runs in CI (`npm test` = Vitest on `packages/core`; `npm run e2e` = Playwright). "Manual" = done once by hand and recorded. Passing tests are not a certification and do not replace independent security, privacy or food-safety review.

## Acceptance tests from the brief
| Brief item | Where | Kind |
|---|---|---|
| Same-looking wrong product | receiving.test "same-looking wrong product" | Automated |
| Changed pack / revision / batch | receiving.test "changed pack variant, changed specification label and uncovered batch" | Automated |
| Incomplete specification | receiving.test "incomplete approved specification flagged"; workflow.test "incomplete specification: can be recorded but cannot be approved" | Automated |
| Precautionary label differences | declarations.test "replacement sauce adds sesame as declaration, peanuts only precautionary" | Automated |
| Mixed sites | workflow.test "mixed sites"; publication.test "annex site is unaffected" | Automated |
| Nested recipes and cycles | declarations.test "nested recipes and cycles" (4 tests) | Automated |
| Simultaneous reviewers | workflow.test "simultaneous reviewers" | Automated |
| Approval replay | workflow.test "approval replay"; "bound to the exact specification revision and impact" | Automated |
| Failed / stale publication channel | publication.test "failed printed-menu update ... retry is idempotent", "adapter that throws" | Automated |
| Old printed copy | publication.test "old printed copy"; e2e service check "OUT OF DATE - replace this copy" | Automated |
| Acknowledgement against wrong revision | publication.test "service acknowledgement" (3 tests) | Automated |
| Offline receiving (write down, check later) | receiving.test "offline receiving" (2 tests); e2e "write down now, check later" | Automated |
| Duplicate scan | receiving.test "duplicate scan or entry"; e2e duplicate | Automated |
| Override expiry | workflow.test "exception ... stops working when it expires"; "override that expires before channel publication blocks" | Automated |
| Staff offboarding | security.test "staff offboarding" | Automated |
| Cross-tenant access | security.test "cross-tenant and cross-site authorisation" (4 tests) | Automated |
| Deletion vs justified audit retention | security.test "deletion versus justified audit retention" (2 tests) | Automated |
| Failure leaves review outstanding, never a false safe status | demo.test (whole chain); declarations property test; publication.test "cannot bypass a pending review" | Automated |
| Supplier outage | Not applicable: there is no supplier feed. Manual entry is the only path. | n/a |
| Unsupported barcode | receiving.test "unknown barcode, mistyped barcode and unsupported formats" | Automated |

## Other safeguards
| ID | Safeguard | Test | Kind |
|---|---|---|---|
| S1 | Unknown never becomes "not declared" (300 random specifications) | declarations.test property test | Automated |
| S2 | No override can mark unknown as allergen-free; the warning override still prints UNRESOLVED | workflow.test "no override can turn unknown..." | Automated |
| S3 | Separation of duties (recorder; specification checker); exceptions named, reasoned, scoped, expiring, not self-granted | workflow.test (4 tests) | Automated |
| S4 | Publication cannot bypass a pending review (prepare blocked; prepared revision goes stale) | publication.test | Automated |
| S5 | Superseded revision cannot be published | publication.test | Automated |
| S6 | Immutability of publications, specs, substitutions | publication.test "snapshots are immutable" | Automated |
| S7 | Atomic commands (failure leaves no partial state or audit entry) | security.test "a failed action changes nothing" | Automated |
| S8 | Audit hash chain detects edits and deletions | security.test | Automated |
| S9 | Encrypted state: no readable data in ciphertext; wrong key/account/rollback/tamper fail | security.test, and e2e "data is stored encrypted" | Automated |
| S10 | Lost key fails closed in the browser | e2e | Automated |
| S11 | No network requests leave the app's origin | e2e | Automated |
| S12 | Android permissions: only CAMERA (barcode scan); everything else blocked | security.test (app.json, expo-camera plugin with microphone off), CI step on the prebuilt manifest (allow-list: CAMERA only), emulator `dumpsys package` | Automated (CI) |
| S13 | No "safe", "free from", "allergen-free" wording in stored data / exports | demo.test, workflow.test | Automated |
| S14 | Refuses to run without WebCrypto | e2e | Automated |
| S15 | Accessibility scan (axe WCAG 2 A/AA) on every screen state | e2e tour, 3 phone sizes | Automated |
| S16 | No horizontal scroll, no overlapping buttons, text inside buttons, targets >= 44 px - normal, 2x and Extra large text | e2e tours | Automated |
| S17 | System bars: content clear of simulated status/navigation bars | e2e `?insets=44,48` | Automated |
| S18 | Keyboard operation | e2e | Automated |

**Hygiene note:** no test asserts that a short substring is absent from random ciphertext (a past flake on a sibling project); encryption checks use long, distinctive strings and structural checks.

## Mutation checks (safeguard broken on purpose, tests must fail, then restored)
See STATUS.md for the recorded results: separation-of-duties check removed, unknown-as-not-declared, cycle check removed, publication basis check removed, acknowledgement revision binding removed, safe-area fix removed, and a text-wrap fix removed.

## Not done
Real-device tests (secure storage, fonts, insets, install); screen-reader testing with people; penetration testing; fuzzing; dependency/SBOM review; independent cryptography review; server tests (tenant isolation on a real backend, invitation replay, revoked sessions, encrypted traffic inspection, restore/delete drills) because no server exists.

## Added in the Android pass (0.2.0)
| ID | Safeguard | Test | Kind |
|---|---|---|---|
| S19 | PIN hash and check, weak PINs refused, random salt, no PIN in state or audit, throttle policy, PIN reset permissions | core `android-pass.test.ts` | Automated |
| S20 | Five status words and their order; a rejected review is never "approved"; the approver cannot acknowledge for staff | core `android-pass.test.ts` | Automated |
| S21 | Ordered/arrived comparison, affected recipes/sites/places, product search, own-kitchen setup end to end, unauthorised add refused | core `android-pass.test.ts` | Automated |
| S22 | Scan result handling: valid known, valid unknown, misread (check digit), empty, other kitchen | mobile `scanFlow.test.ts` | Automated |
| S23 | Design tokens: contrast for every pair in light and dark, 16 sp body, nothing under 14 sp, 48 dp targets | mobile `tokens.test.ts` | Automated |
| S24 | Served page carries `application-id` = this app, so a test cannot talk to another app on the port | e2e | Automated |
| S25 | Idle auto-lock, wrong-PIN throttle, step-up PIN on erase, first-sign-in PIN choice, drafts private to the person and sealed at rest | e2e (browser) | Automated (browser only) |
| S26 | Emulator: install, launch, back, keyboard, process-death restore, permission flows, scan timeout | `android-tests/` via CI | Automated on an emulator (not a physical device) |

**What these do not establish:** that scanning works on real packs; that the PIN lock behaves on a physical tablet; that any wording is understood by a fresh user; that the app is secure.
