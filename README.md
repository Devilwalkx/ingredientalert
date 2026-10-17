# IngredientAlert

A phone-first receiving and substitution **approval** tool for **one kitchen**: when a delivery is not what was ordered, a second person checks the supplier paperwork, the affected recipes (including recipes inside recipes) are found, the change is approved as an exact revision, the new allergen information is published to separate channels, and service staff acknowledge it. Anything unknown stays **UNKNOWN** and blocks routine publication.

> **Honest status.** Local-first: no server, so the QR / web menu and the printer are **simulated**; no notifications are sent. You can set up your own kitchen (people with PINs, products, recipes) or try a clearly labelled made-up example kitchen. It **supports trained people and existing kitchen controls; it cannot guarantee a dish is safe** and must shadow, not replace, your procedures. Not legal, privacy, security or food-safety certified. **Never run on a physical phone yet** (emulator and browser evidence only; real-world barcode scanning is NOT TESTED). Existing allergen systems may already cover much of this (not verified here). See [SPEC.md](SPEC.md) and [STATUS.md](STATUS.md).

## Install on Android
Plain-English steps: [GETTING_STARTED.md](GETTING_STARTED.md). **Application id `app.devilwalkx.ingredientalert`**: older test builds had a different id, so uninstall them first (Android sees a different app). Check which build you have in Settings > About this build. Download `IngredientAlert-test.apk` from
https://github.com/Devilwalkx/ingredientalert/releases/tag/latest-test-build (debug-signed, testing only).

## Repository map
| Path | What |
|---|---|
| `packages/core` | All rules in pure TypeScript with the unit tests: allergens, receiving mismatch, declarations and nesting, review workflow, publication channels, acknowledgement, overrides, offboarding, retention, audit chain, encrypted state vault |
| `apps/mobile` | Expo (Android + web) app: Home, delivery with camera barcode scan, review, publication updates, service menu, settings, PIN sign-in |
| `e2e` | Playwright browser tests at Pixel 7, 390 px and 320 px widths (port 4421) |
| `android-tests` | Maestro flows and measurements run on a CI emulator |
| `.github/workflows/build.yml` | Tests, web build, Android APK, and the always-newest test release |
| `docs` | SCREEN_DECISIONS, SHARED_DEVICE_SESSIONS, USABILITY_SESSION_PLAN, ANDROID_PASS_REPORT, evidence screenshots |
| Docs | SPEC, DATA_FLOWS, THREAT_MODEL, PERMISSIONS, PRIVACY_REGISTER, RETENTION, RISK_REGISTER, SECURITY_TESTS, DECISIONS, STATUS (all DRAFTS for review) |

## Run it
```bash
npm install
npm test                 # core unit tests
npm run typecheck
npm run demo             # console walk-through of the sauce story
npm run e2e              # builds the web app, runs Playwright (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 and a local Chromium if offline)
cd apps/mobile && npx expo start   # development (Metro on 8421)
```
Versions follow Expo SDK 58 (React 19.3, React Native 0.88), taken from the installed `expo` package's module list.

## Wording rules this repo follows
No claims of "production ready", "fully GDPR compliant", "zero errors", "safe to serve" or "allergen-free" as a product claim. Competitor and regulator facts are **not verified** (sites unreachable from the build environment).
