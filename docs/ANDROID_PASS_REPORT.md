# IngredientAlert: Android pass report (0.2.0, test build)

Branch `claude/h-gm8m50`. Last code commit `fabd806`. Main was **not** pushed: the emulator jobs of the latest run are red.

Evidence rules used here: emulator results are not physical-device results. Browser results are not Android results. TalkBack was not usability-tested. No usability session was run. A passing test is not a claim that a feature works for real kitchen staff.

Status words: PASS, PARTIAL, FAIL, NOT TESTED, BLOCKED.

CI runs cited:
* run 13, Actions run `39066016008`, commit `5002796`
* run 15, Actions run `39068623501`, commit `fabd806` (the latest code commit)

Screenshots cited are copied into `docs/evidence/emulator/` with names starting `r13-` or `r15-`. Their originals are in the `evidence/run-13` and `evidence/run-15` branches.

---

## 1. State table

| Area | Status | Evidence / file |
|---|---|---|
| Identity: `app.devilwalkx.ingredientalert`, version 0.2.0, versionCode from run number | PASS | `apps/mobile/app.json`, `apps/mobile/app.config.js`; run 15 `android-apk` job, step "Check identity and back-gesture settings" |
| Ports: e2e 4421, Metro 8421, app-id meta test | PASS | `e2e/playwright.config.ts`, `apps/mobile/package.json` (`start`), `e2e/tests/app.spec.ts`; run 15 `test-and-web` job passed |
| Permissions: only CAMERA, no INTERNET, backup off, predictive back on | PASS | `apps/mobile/app.json` (`permissions: []` plus the camera plugin), CI step "Check requested permissions" passed in run 15 |
| Encryption wording (no "scrambled" in app source) | PASS | `grep` of `apps` and `packages` found none (run on this commit) |
| `docs/ENCRYPTION_ACCOUNT.md` | PASS (document exists and covers the requested items) | `docs/ENCRYPTION_ACCOUNT.md`. Not reviewed by a cryptographer |
| On-phone encryption check passes on the CI emulators | PASS | flow `12-encryption-check` passed on API 36 and API 29 in run 13 and run 15 |
| Release signing prepared (secrets-driven, no keys in git) | PARTIAL | workflow steps "Detect the owner's private signing key" (skipped: no secret) and "Point Gradle's release build..." (skipped). No private key exists |
| `docs/SIGNING.md` | PASS (document exists) | `docs/SIGNING.md` |
| Signing consequence (differently signed APK refused over the install) | PASS | `signing-consequence.txt` in run 15 on both emulators: `INSTALL_FAILED_UPDATE_INCOMPATIBLE` |
| APK identity recorded (`build-identity.txt`) | PARTIAL | step "Record what identifies this APK" passed in run 15. File contents were not read here. Known bug: `scripts/apk-identity.sh` labels the signer wrongly (see section 9) |
| A11y tree audit recorded | PARTIAL | `a11y-tree.jsonl` present on both emulators in run 13 and run 15. Audit results were not reviewed here |
| TalkBack experiment | NOT TESTED (experiment only) | API 36 image ran the experiment in run 15 (`talkback/` folder). API 29 image has no TalkBack: "NOT TESTED". No usability test with a screen-reader user |
| Maestro flows: main task | PARTIAL | flow 02 passed on API 36 (run 15) and on API 29 (run 13); failed on API 29 in run 15 (see section 5) |
| Maestro flows: back | PASS | flow 04 passed on both emulators in runs 13 and 15 |
| Maestro flows: keyboard | PARTIAL | flow 08 passed on API 29 in run 15 after the keyboard fix; failed on API 36 in run 15; passed on API 36 in run 13 |
| Maestro flows: process death and restore | PASS | flow 06 passed on both emulators in runs 13 and 15 |
| Maestro flows: offline | NOT TESTED | no offline flow exists |
| Maestro flows: clean install | PASS (emulator, fresh state) | flow 01 uses `clearState`; passed on both emulators |
| Upgrade from the previous release APK | NOT TESTED | previous release has a different package id (`upgrade.txt`) |
| Camera: first denial, plain explanation, manual search works | PASS | flow 16 passed on both emulators in runs 13 and 15. Screenshot `r13-api36-16-first-denial.png` shows "Camera not allowed. You can try again, or type the number instead." |
| Camera: permanent denial, points to system settings, manual search works | PARTIAL | API 36: flow 10 passed in run 15 (screenshot `r13-api36-10-permanent-denial.png` shows "The camera is switched off for this app" and "Open Android settings"). API 29 at 200% text: flow 10 failed in runs 13 and 15 (Maestro did not match the title, which is visible in `r13-api29-10-permanent-denial.png`) |
| Camera granted: scanner opens with torch control and says when nothing is read | PASS (control shown, no decode) | flow 03 passed on both emulators in runs 13 and 15 (screenshot `r13-api36-03-scanner-open.png`). Torch hardware not tested |
| Scan of a known synthetic barcode succeeds | BLOCKED (emulator) | flow 15 failed on both emulators in runs 13 and 15. The virtual scene reports "Unsupported camera format for virtual scene views 842093913", so no frame is decoded. See `r15` and `r13` scanner evidence |
| Failed scan: timeout notice, retry, manual entry | PASS | flow 09 passed on both emulators in runs 13 and 15 (screenshot `r13-api36-09-scan-timeout.png`: "No barcode was read in 20 seconds. Try again, or type the number...") |
| Side-by-side products; contains / precautionary / cross-contact shown separately | NOT CONFIRMED | `r13-api36-02-side-by-side.png` is cited but was not reviewed by eye in this pass. Treat as PARTIAL until reviewed |
| Notification is not acknowledgement | NOT TESTED | no flow tests a notification. The app sends none |
| Shared device: two named staff acknowledge, each recorded under their own name | PASS (flow) | flow 13 passed on both emulators in runs 13 and 15. Screenshot `r13-api36-13-approver-cannot-acknowledge.png` shows the approver told this step is for service staff |
| One session cannot act as another | PASS (flow) | flow 13 includes "a person without the service role cannot" and passed |
| Session auto-lock | PASS (flow) | flow 14 passed on both emulators in runs 13 and 15 (screenshot `r13-api36-14-auto-locked.png`, not reviewed by eye) |
| Recent-apps / screenshots blocked | NOT TESTED (not implemented) | `FLAG_SECURE` not set, as documented |
| Physical device | NOT TESTED | no physical device |
| Usability with fresh users | NOT RUN | `docs/USABILITY_SESSION_PLAN.md` says NOT RUN |

## 2. Architecture facts

* Framework: Expo SDK 58, React Native 0.88 (`apps/mobile/package.json`). Native Android project generated by `expo prebuild` in CI. Single JavaScript app, no WebView wrapper.
* Storage: whole kitchen database in `ia-state.json`, drafts in `ia-drafts.json`, settings in `ia-settings.json`. Code: `apps/mobile/src/storage.ts`.
* Encryption: XChaCha20-Poly1305 via `@noble/ciphers`; PIN hashes with scrypt via `@noble/hashes` (`packages/core`). Key in `expo-secure-store` (`apps/mobile/src/keystore.ts`). Details: `docs/ENCRYPTION_ACCOUNT.md`.
* Domain logic: `packages/core` (including `selfcheck.ts`, the on-phone encryption check).
* Permissions: CAMERA only, for barcode scanning (`apps/mobile/src/Scanner.tsx`, `scanFlow.ts`). No network permission. The app makes no network calls.
* External services: none. No server, no notifications, no analytics.
* Screens: `apps/mobile/src/screens/` (Entry, Home, Deliver, Review, Service, Publish, Settings, shared). Navigation and back handling in `apps/mobile/App.tsx`.

## 3. Changes in this pass and why

* `android-tests/run.sh`: pass `PKG` and `OUT` to the TalkBack experiment. Run 13 failed that step with an unbound variable. Commit `e2b54b8`.
* `apps/mobile/App.tsx`: after the keyboard shows, measure the focused field and scroll so the field and about 100 dp below it stay on screen (scaled by font size). Ported from ScopeLock. Reason: run 13, API 29 at 200% text, showed the keyboard covering the Next button on the kitchen setup screen. Commit `fabd806`.
* Earlier commits (`65fbc03`, `5002796`) hold the encryption self-check, shared-device sessions, auto-lock, camera scan and its flows, the a11y audit script, the TalkBack experiment script, and the docs.

Effect of the keyboard change, as far as CI shows: API 29 flow 08 passed in run 15 (it failed in run 13). API 36 flow 08 failed in run 15 at a later step, and API 29 flow 02 failed in run 15 (it passed in run 13). Whether the change caused these is **not established**: the failures are in different flows on each emulator and the screenshots do not settle it.

## 4. Main task, exact user journey

Example kitchen path (demonstration data, labelled as such in the app):

1. First run: two clear starts, "Try the example kitchen" or "Set up my kitchen". No demonstration controls on the first screen (flow 01).
2. Check a delivery: pick the product (for example Harbour Teriyaki Sauce 1L), then "Scan the barcode". The scan step offers torch, retry, and "Type the number or search instead" (flows 03, 09, 16).
3. Compare what arrived with what was ordered, then review the substitution. Side-by-side products; approval dialog; result shown after approval (flow 02).
4. Real kitchen setup (flow 08): two names, step 1 of 2 then step 2 of 2, PIN, then "Start my kitchen", then "Finish setting up".

Manual steps that the emulator flows do not cover: scanning a real barcode; a real camera; the physical keyboard of a real phone.

Missing services: none needed for the journey. Notifications are not sent by design.

## 5. Android verification facts

| Item | Result |
|---|---|
| Emulator 1 | API 36, `pixel_6`, x86_64, font scale 1.0, Android 16. Run 15 job `android-emulator (api36-pixel6-standard)` |
| Emulator 2 | API 29, `pixel_5`, x86_64, font scale 2.0 (200%), night mode on. Run 15 job `android-emulator (api29-pixel5-text200-dark)` |
| Build | Test build signed with the public Android debug key. `versionName 0.2.0`. Run 13: `versionCode 13`; run 15 builds the APK in the `android-apk` job of run 15 |
| Install | Fresh install passed on both emulators (flow 01 with clean state). Upgrade: NOT TESTED |
| Back | PASS (flow 04, both emulators) |
| Keyboard | PARTIAL (section 3). API 36 run 15 flow 08 failed; API 29 run 15 flow 08 passed |
| Permissions | First denial PASS; permanent denial PARTIAL (API 36 PASS, API 29 at 200% FAIL in soft flow 10); granted, no decode (flow 03) |
| Background / relaunch / process death | PASS (flows 05 and 06 on both emulators: the unsent delivery is still there after the process is killed) |
| Offline | NOT TESTED |
| Notifications | None exist |
| Emulator vs browser | All numbers above are emulator. Browser evidence is in `docs/evidence/before` and `docs/evidence/after` (not re-read in this pass) |
| Physical device | NOT TESTED |

Run 15 gating results (flows that fail the job):

* API 36: flow 08 "No visible element found: Finish setting up". Screenshot `r15-api36-08-failed-ended-on-home.png` shows the app on Home (the flow did not reach the setup finish screen).
* API 29: flow 02 "No visible element found: Save specification". Screenshot `r15-api29-02-failed-save-not-visible.png` shows the substitution form mid-way at 200% text, with the save button below the visible area.

Soft flows (not gating, recorded): flow 15 known-barcode scan failed on both emulators (see section 1: BLOCKED); flow 10 failed on API 29 only.

## 6. Visual, accessibility and TalkBack evidence

* Screenshots: `docs/evidence/emulator/r13-*` and `docs/evidence/emulator/r15-*` (listed in section 1). Originals: `evidence/run-13` and `evidence/run-15` branches.
* Viewed by eye in this pass: `r13-api36-16-first-denial.png`, `r13-api36-10-permanent-denial.png` (via run screenshot), `r13-api36-13-approver-cannot-acknowledge.png`, `r13-api29-08-keyboard-open-covers-next.png` (the keyboard covers the Next button at 200%), `r15-api29-02-failed-save-not-visible.png`, `r15-api36-08-failed-ended-on-home.png`, `r13-api36-15-scan-known-barcode-not-read.png`. Others were not viewed by eye and are not used as confirmation.
* Contrast: unit tests `apps/mobile/src/design/tokens.test.ts` in `npm test` (12 tests in 2 files, all passed in this pass). Not a full audit.
* Touch targets: no measured audit in this pass.
* A11y tree: `a11y-tree.jsonl` files in evidence; not reviewed in this pass (PARTIAL).
* TalkBack: API 36 experiment ran in run 15 (`talkback/` in the evidence folder); its output was not read in this pass. API 29 has no TalkBack: NOT TESTED. **TalkBack NOT TESTED as a usability test.**

## 7. Test evidence

Commands run locally on the branch head (before the fabd806 push):

* `npm run typecheck`: passed (no errors).
* `npm test`: 12 tests in 2 files passed.
* `bash -n android-tests/run.sh`: passed.
* YAML parse of `.github/workflows/*.yml`: passed.

CI (run 15, `fabd806`):

| Job | Result |
|---|---|
| test-and-web (typecheck, unit tests, web build, Playwright e2e) | success |
| android-apk (build, permission check, identity check, APK identity) | success |
| android-emulator api36-pixel6-standard | failure (flow 08 gating) |
| android-emulator api29-pixel5-text200-dark | failure (flow 02 gating) |
| publish-evidence | success |
| publish-release | skipped (main only) |

Run 13 (`5002796`): test-and-web success, android-apk success, api36 emulator success (with TalkBack step error, since fixed), api29 emulator failure (flow 08 gating), publish-evidence success, publish-release skipped.

Negative tests in the flows: wrong PIN, weak PIN, two different staff accounts, service-role check, tampered encryption blob (refused in flow 12 and in unit tests), signing-consequence check (refused install).

**What these tests do not establish:** real-device behaviour; real barcode decoding; real camera permission dialogs on a physical phone; fresh-user usability; any claim about data protection in the sense of an audit or review. Passing flows show the emulator path works in those runs; they do not show the feature is ready for kitchens.

## 8. Privacy and security facts

* What leaves the device: nothing. No network permission, no server, no analytics. Checked in CI only by the permission check and by reading the code for network calls; no traffic capture was made.
* Who can read each data type: the signed-in person sees what their role allows. Another app on the phone cannot read the app's files under normal Android separation. Anyone with root or a forensic image taken with the key can read the data: not tested or defended against.
* Storage: the kitchen database is encrypted with a key held by Android's keystore through `expo-secure-store`. File names, sizes and times are readable without the key. Settings file is plain text (see `docs/ENCRYPTION_ACCOUNT.md`).
* Screenshots are not blocked (`FLAG_SECURE` not set).
* Recovery and deletion: there is no backup and no reset. Losing the key (new phone, cleared data, uninstall) loses the data. Rollback to an older copy of the storage is not detected.
* Release signing: test signature only. A private release key has not been created (owner decision, see `docs/SIGNING.md`).
* Open reviews: no independent cryptographic or security review has taken place.

## 9. Known issues

| # | Severity | User impact | Repro | Affected code | Proposed fix |
|---|---|---|---|---|---|
| 1 | High | At 200% text on a small phone, the keyboard can hide the Next action on the setup screen (run 13 evidence). Fix in `fabd806` is not yet proven: API 29 flow 08 passed in run 15 but API 36 flow 08 failed | Flow 08 on API 29 at 200% | `apps/mobile/App.tsx` (keyboard handler), `apps/mobile/src/screens/Entry.tsx` | Confirm on a second run; add a flow that asserts the Next button is above the keyboard |
| 2 | High | The main task (check a delivery) fails in flow 02 on API 29 at 200% text (save button not reached) | Flow 02 on API 29 (run 15) | `apps/mobile/src/screens/Deliver.tsx` / `Review.tsx` long forms, scrolling | Investigate the scroll and keyboard interaction at 200%; add a scroll-to-save step |
| 3 | Medium | Known-barcode scan cannot be shown on the emulator: no frame is decoded | Flow 15 | emulator virtual scene (not app code); `Scanner.tsx` | Use a physical device, or a dedicated test hook that feeds a decoded value (would be a test-only path: owner decision) |
| 4 | Medium | Permanent-denial text not matched on API 29 at 200% (soft flow 10). Screen shows it | Flow 10 on API 29 | flow `10-camera-permission-denied.yaml` | Assert on a shorter phrase or on the button label |
| 5 | Medium | `scripts/apk-identity.sh` in the repo labels the signer wrongly (empty certificate line, and says "PRIVATE" when the key is public) | Read `build-identity.txt` in the build | `scripts/apk-identity.sh` | Replace with the corrected script (see the open item below) |

Open item (not done): the coordinator asked for the corrected `apk-identity.sh` to replace the repo version. The copy was refused by the auto-mode permission check. It has **not** been applied. The owner or coordinator must approve that action; the copy source is the scratchpad `shared/apk-identity.sh`.

## 10. Next actions

1. Decide whether to accept the keyboard change (`fabd806`) on the basis of a second CI run. Cost: one CI run (about 30 minutes). Dependency: none. Owner or lead decision: whether the 200% emulator flows are gating for main.
2. Investigate flow 02 at 200% text (issue 2). Cost: one or two CI runs. Dependency: item 1.
3. Apply the corrected `scripts/apk-identity.sh` (issue 5). Needs the coordinator's or owner's approval for the file copy, since the copy was refused. Then re-read `build-identity.txt` in the next build.
4. Physical device run of the main task and the camera paths (permission dialogs and a real barcode). Cost: a phone and a few hours. Owner decision: who runs it.
5. TalkBack usability test with a screen-reader user. Cost: recruitment. Owner decision.
6. Fresh-user usability sessions (`docs/USABILITY_SESSION_PLAN.md`). Cost: participants. Owner decision.
7. Owner creates the private release key (`docs/SIGNING.md`). Owner decision; the key must not be created in CI.
8. Push to main only after every CI job on the commit is green. Currently it is not.

---

## Requirements checklist

Each line: status and where it is evidenced. Statuses are not upgraded beyond what was read.

- [x] Application id, version, ports, app-id test: PASS (`app.json`, `playwright.config.ts`, `app.spec.ts`; run 15 test-and-web)
- [x] Forbidden permissions checked in CI: PASS (run 15 android-apk step)
- [x] Encryption wording accurate (no "scrambled"): PASS (grep of app and core source)
- [x] `docs/ENCRYPTION_ACCOUNT.md`: PASS (document; not reviewed by a cryptographer)
- [x] On-phone encryption check passes in CI emulator: PASS (flow 12, API 36 and API 29, runs 13 and 15)
- [~] Release signing prepared, secrets-driven, no keys in git: PARTIAL (configuration present; no private key; not switched on)
- [x] `docs/SIGNING.md`: PASS (document)
- [x] Signing consequence (differently signed APK refused): PASS (run 15, both emulators)
- [~] APK identity in `build-identity.txt` and release notes: PARTIAL (step succeeded; file not read; signer label bug open; release notes only on main, not run)
- [~] A11y tree audit recorded: PARTIAL (files present; not reviewed)
- [ ] TalkBack probe or experiment recorded: NOT TESTED as usability (experiment ran on API 36 in run 15; output not read; API 29 has none)
- [~] Maestro flows for the main task: PARTIAL (flow 02 failed on API 29 in run 15)
- [x] Maestro back: PASS (flow 04)
- [~] Maestro keyboard: PARTIAL (flow 08 passed on API 29, failed on API 36 in run 15)
- [x] Maestro process death: PASS (flow 06)
- [ ] Maestro offline: NOT TESTED (no flow)
- [x] Camera first denial explained, manual search works: PASS (flow 16, both emulators)
- [~] Camera permanent denial points to settings: PARTIAL (API 36 PASS; API 29 at 200% FAIL in soft flow 10)
- [~] Camera granted, scanner opens, torch control, honest when nothing read: PARTIAL (flow 03 PASS; no decode)
- [ ] Known synthetic barcode scan succeeds: BLOCKED (emulator cannot decode the virtual scene)
- [x] Failed scan recovery to manual entry: PASS (flow 09)
- [~] Side-by-side products; contains / precautionary / cross-contact separate: PARTIAL (screenshot cited; not reviewed by eye)
- [ ] Notification is not acknowledgement: NOT TESTED
- [x] Shared device: two named staff, each recorded under their own name: PASS (flow 13; approver screen confirmed by eye)
- [x] One session cannot act as another: PASS (flow 13)
- [x] Session auto-lock: PASS (flow 14)
- [ ] Clean install and upgrade from previous APK: clean install PASS (flow 01); upgrade NOT TESTED
- [ ] Physical device: NOT TESTED
- [x] `docs/USABILITY_SESSION_PLAN.md` states NOT RUN: PASS
- [x] This report, 10 sections plus checklist: PASS (document; evidence cited)
