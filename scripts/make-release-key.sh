#!/usr/bin/env bash
# Run this ON YOUR OWN COMPUTER (not in a cloud session, not in CI). Needs a JDK (keytool).
# Creates ONE private signing key for ONE app. Usage: ./make-release-key.sh ingredientalert
set -euo pipefail
app="${1:?usage: make-release-key.sh <app-name, e.g. ingredientalert>}"
file="$app-release.jks"
[ -e "$file" ] && { echo "$file already exists; refusing to overwrite it"; exit 1; }
keytool -genkeypair -v -keystore "$file" -alias "$app" -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=$app, O=Devilwalkx"
echo
echo "Created $file. Do these now, before anything else:"
echo " 1. Put at least TWO copies in different places you control (password manager attachment + an offline USB stick)."
echo " 2. Store the keystore password and key password in the password manager (same place as the file)."
echo " 3. Print the fingerprint and keep it in your notes; every release build must show this exact value:"
keytool -list -v -keystore "$file" -alias "$app" | grep "SHA256:"
echo " 4. NEVER commit it, email it, or paste it into a chat. Then add it to GitHub as repository secrets (see docs/SIGNING.md)."
