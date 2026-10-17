#!/usr/bin/env node
// Makes the generated Android project sign its release build with the owner's PRIVATE key.
// The key file and passwords are read from environment variables at build time and are never written into any file:
//   ANDROID_KEYSTORE_PATH  path to the .jks/.keystore file (CI writes it from a secret, deletes it afterwards)
//   ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
// Usage: node scripts/configure-release-signing.mjs apps/mobile/android/app/build.gradle
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: configure-release-signing.mjs <build.gradle>"); process.exit(2); }
let g = readFileSync(file, "utf8");
if (g.includes("signingConfigs.release")) { console.log("release signing already configured"); process.exit(0); }

const releaseCfg = `        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH") ?: "missing.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
`;
if (!/signingConfigs\s*\{/.test(g)) throw new Error("signingConfigs block not found: the generated Gradle file has a new layout; update this script");
g = g.replace(/signingConfigs\s*\{\n/, (m) => m + releaseCfg);

// Inside buildTypes { ... release { ... } } switch the signing config from debug to release.
const bt = g.indexOf("buildTypes");
const rel = g.indexOf("release {", g.indexOf("buildTypes", bt));
if (bt < 0 || rel < 0) throw new Error("buildTypes.release not found");
const end = g.indexOf("\n        }", rel);
const block = g.slice(rel, end);
if (!block.includes("signingConfig signingConfigs.debug")) throw new Error("release build type does not use the debug key as expected: update this script");
g = g.slice(0, rel) + block.replace("signingConfig signingConfigs.debug", "signingConfig signingConfigs.release") + g.slice(end);
writeFileSync(file, g);
console.log("release signing configured from environment variables");
