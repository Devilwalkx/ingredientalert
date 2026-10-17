# Evidence

Nothing here is a physical-device result. Browser screenshots come from Chromium emulating a phone; emulator screenshots come from the Android emulator in GitHub Actions.

| Folder | What | How made |
|---|---|---|
| `before/` | The app as it was before the 0.2.0 pass (commit 6fb90b3): welcome, home, delivery form, delivery result, review, approve confirmation, at Pixel 7 (412 px) and 320 x 568, light only, and 200% text for home and result | Playwright against a web export of the previous commit |
| `after/` | The same states in 0.2.0, light, dark and (Pixel 7) 200% text, plus extras (lock screen, scan fallback, specification form, impact, decision, publication failed, service, status). Names `N-name-pixel7[-dark|-text200].png` / `-small320` | Playwright tours in `e2e/tests` (`SHOTS=<dir>`), same states as `before/` |
| `emulator/` | Screenshots from Maestro flows on an API 36 and an API 29 emulator (see the report for which run) | `android-tests/run.sh` via the CI `android-emulator` job; also kept on the `evidence/run-<N>` branch |

"After" 200% text uses `?fontscale=2` in the browser build. On Android the system font scale applies on top of the in-app text size.
