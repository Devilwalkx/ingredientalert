#!/usr/bin/env bash
# Prints what identifies one APK: package, version, signer certificate SHA-256, APK SHA-256, source commit and CI run.
# Usage: scripts/apk-identity.sh path/to.apk > build-identity.txt   (needs the Android SDK build-tools: apksigner, aapt2)
set -euo pipefail
apk="$1"
bt=$(ls -d "${ANDROID_HOME:-/usr/local/lib/android/sdk}"/build-tools/* | sort -V | tail -1)
sha=$(sha256sum "$apk" | cut -d' ' -f1)
size=$(stat -c %s "$apk")
badge=$("$bt/aapt2" dump badging "$apk" | head -1)
pkg=$(sed -n "s/.*package: name='\([^']*\)'.*/\1/p" <<<"$badge")
vcode=$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$badge")
vname=$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<<"$badge")
cert=$("$bt/apksigner" verify --print-certs "$apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')
DEBUG_CERT=fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c
kind="PRIVATE release key (owner-controlled)"
[ "$cert" = "$DEBUG_CERT" ] && kind="PUBLIC Android debug key: test signing only, anyone can sign an APK with this key"
echo "package:          $pkg"
echo "versionName:      $vname"
echo "versionCode:      $vcode"
echo "source commit:    ${BUILD_COMMIT:-${GITHUB_SHA:-unknown}}"
echo "CI run number:    ${GITHUB_RUN_NUMBER:-unknown} (${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-unknown}/actions/runs/${GITHUB_RUN_ID:-unknown})"
echo "signer cert SHA-256: $cert"
echo "signing key kind: $kind"
echo "APK SHA-256:      $sha"
echo "APK size (bytes): $size"
