# IngredientAlert (synthetic demo)

A phone-first receiving and substitution **approval** tool for **one kitchen**: when a delivery is not what was ordered, a second person checks the supplier paperwork, the affected recipes (including recipes inside recipes) are found, the change is approved as an exact revision, the new allergen information is published to separate channels, and service staff acknowledge it. Anything unknown stays **UNKNOWN** and blocks routine publication.

> **Honest status.** Local-first and synthetic: no server, no real staff logins (one phone plays every role), 20 made-up ingredients, a controlled made-up recipe set. It **supports trained people and existing kitchen controls; it cannot guarantee a dish is safe** and must shadow, not replace, your procedures. Not legal, privacy, security or food-safety certified. **Never run on a real phone yet.** Existing allergen systems may already cover much of this (not verified here). See [SPEC.md](SPEC.md) and [STATUS.md](STATUS.md).

## Install on Android
Plain-English steps: [GETTING_STARTED.md](GETTING_STARTED.md). Download `IngredientAlert-test.apk` from
https://github.com/Devilwalkx/ingredientalert/releases/tag/latest-test-build (debug-signed, testing only).

## Repository map
| Path | What |
|---|---|
| `packages/core` | All rules in pure TypeScript with the unit tests: allergens, receiving mismatch, declarations and nesting, review workflow, publication channels, acknowledgement, overrides, offboarding, retention, audit chain, encrypted state vault |
| `apps/mobile` | Expo (Android + web) app: Home, delivery, review, publish, service, settings |
| `e2e` | Playwright browser tests at Pixel 7, 390 px and 320 px widths |
| `.github/workflows/build.yml` | Tests, web build, Android APK, and the always-newest test release |
| Docs | SPEC, DATA_FLOWS, THREAT_MODEL, PERMISSIONS, PRIVACY_REGISTER, RETENTION, RISK_REGISTER, SECURITY_TESTS, DECISIONS, STATUS (all DRAFTS for review) |

## Run it
```bash
npm install
npm test                 # core unit tests
npm run typecheck
npm run demo             # console walk-through of the sauce story
npm run e2e              # builds the web app, runs Playwright (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 and a local Chromium if offline)
cd apps/mobile && npx expo start   # development
```
Versions follow Expo SDK 58 (React 19.3, React Native 0.88), taken from the installed `expo` package's module list.

## Wording rules this repo follows
No claims of "production ready", "fully GDPR compliant", "zero errors", "safe to serve" or "allergen-free" as a product claim. Competitor and regulator facts are **not verified** (sites unreachable from the build environment).
