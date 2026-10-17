# IngredientAlert: release signing (prepared, not yet switched on)

Status: **the signing configuration is written and the owner steps are documented. No private key exists yet.** Every APK published so far is signed with the public Android debug key and is labelled "test build" everywhere. Nothing in this repository, in any APK, in any release attachment or in any report contains a keystore, a password or any other signing secret, and none ever should.

## Why a private key matters
Android identifies "the same app" by its package id **and** its signing certificate. Anyone can sign an APK with the public debug key, so a debug-signed APK proves nothing about who built it. A private release key proves that a later update comes from whoever holds the key. The key is also permanent: lose it and no update can ever be installed over existing installs.

## What the owner does (once, on your own computer, not in a cloud session)
1. Install a JDK (Android Studio includes one). Run `scripts/make-release-key.sh ingredientalert`. It creates `ingredientalert-release.jks` and prints the certificate fingerprint.
2. Make at least two copies of that file in different places you control (a password-manager attachment and an offline USB stick). Store both passwords next to it. Without a backup, losing the file loses the ability to update the app.
3. Add four **repository secrets** in GitHub (Settings > Secrets and variables > Actions): `ANDROID_KEYSTORE_B64` (the file, base64-encoded: `base64 -w0 ingredientalert-release.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`ingredientalert`), `ANDROID_KEY_PASSWORD`.
4. Write down the fingerprint. From then on every release must show exactly that value in `build-identity.txt` (attached to the release, and in Settings > About).

I did **not** create the key in the cloud session: a key that exists only inside a disposable environment would be lost when the session ends, and a copy that lives anywhere else is a second thing to protect.

## What the build does (scripts/configure-release-signing.mjs, workflow `android-apk`)
* If the four secrets exist, the workflow writes the keystore to a temporary file, runs `scripts/configure-release-signing.mjs` (it points Gradle's `release` build type at environment variables, so no password is ever written into a file), builds, and deletes the file.
* If the secrets do not exist, it builds with the debug key exactly as today and the release is named `IngredientAlert-test.apk`.
* A build signed with the private key is named `IngredientAlert.apk` and its Settings > About line says "Release build, private key". A debug-signed build says "Test build, public test key". `scripts/apk-identity.sh` prints the signer certificate SHA-256 into `build-identity.txt` for every build, and says which kind it is, so the two can never be confused.

## What switching keys does to people who already installed the test build
* **Android will refuse to install the release APK over the test APK.** The package id is the same but the signing certificate differs, so the install fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. The only route is to uninstall the test build first.
* **Uninstalling deletes everything the app stored** (including its encryption key, because the key lives in the app's own protected storage and `allowBackup` is off). It cannot be restored from Android backup.
* Therefore: switch **before** anybody keeps real data in a test build, or export first. IngredientAlert has **no backup or export** of its data in this build, so there is nothing to carry across: anything entered in a test build is lost at the switch. Use the example kitchen only until the release key is in place.
* This was tested on an emulator (see "Tested" below): installing a differently signed APK over the test build is refused, and the existing installation and its data are untouched by the failed attempt.
* Keep test and release builds distinguishable: they have different file names, different About text, and the test build says so on its About page. They cannot be installed side by side because the package id is the same; if you want both on one phone, use a different package id for the test channel (a one-line change in `app.config.js`; it would cost the same one-time reinstall).

## Tested
* `scripts/configure-release-signing.mjs` was run against the real output of `expo prebuild` and changes only the release build type (checked by diff).
* The CI "signing dry run" re-signs the built test APK with a throw-away key created inside that CI job (not a real key, destroyed with the job), installs it over the test build on an emulator, and records that Android refuses it and that the data of the existing installation survives. See the evidence for the run in `docs/ANDROID_PASS_REPORT.md`.
* **Not tested:** a build signed with a real private key (none exists), Play App Signing, key rotation.

## Play Store note (not planned)
If the app is ever published on Google Play, use Play App Signing: Google holds the app signing key and you hold only an *upload* key, which can be reset if lost. Sideloaded APKs from GitHub have no such safety net.
