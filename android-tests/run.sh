#!/usr/bin/env bash
# Runs inside the Android emulator job. Everything it measures is written to $OUT; nothing here is a claim by itself.
set -u
PKG=app.devilwalkx.ingredientalert
APK=${APK:?path to apk}
OUT=${OUT:-out}
FONT=${FONT:-1.0}
NIGHT=${NIGHT:-no}
mkdir -p "$OUT/shots" "$OUT/junit" "$OUT/hierarchy"
FAIL=0
log() { echo "== $*" | tee -a "$OUT/log.txt"; }

adb wait-for-device
adb shell getprop ro.build.version.release > "$OUT/device.txt"
{ echo -n "sdk="; adb shell getprop ro.build.version.sdk; echo -n "model="; adb shell getprop ro.product.model; echo -n "abi="; adb shell getprop ro.product.cpu.abi; echo -n "size="; adb shell wm size; echo -n "density="; adb shell wm density; echo "font_scale=$FONT night=$NIGHT"; } | tr -d '\r' >> "$OUT/device.txt"

log "install"
adb install -r "$APK" 2>&1 | tee -a "$OUT/log.txt"
adb shell dumpsys package $PKG | grep -E "versionName|versionCode|requested permissions|android.permission|granted=" | tr -d '\r' > "$OUT/package.txt"
# the MERGED manifest of the installed app (libraries add permissions too): only CAMERA may be requested
REQ=$(adb shell dumpsys package $PKG | tr -d '\r' | sed -n '/requested permissions:/,/install permissions:/p' | grep -o 'android\.permission\.[A-Z_]*' | sort -u)
echo "requested (merged manifest): $REQ" | tee -a "$OUT/log.txt"
for p in $REQ; do if [ "$p" != "android.permission.CAMERA" ]; then echo "UNEXPECTED PERMISSION: $p" | tee -a "$OUT/log.txt"; FAIL=1; fi; done
adb shell settings put system font_scale "$FONT"
adb shell cmd uimode night "$NIGHT"
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0

# baseline evidence that does not depend on Maestro: launch, screenshot, accessibility hierarchy
log "baseline launch"
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 8
adb exec-out screencap -p > "$OUT/shots/00-launch.png"
adb shell uiautomator dump /sdcard/launch.xml >/dev/null 2>&1 && adb pull /sdcard/launch.xml "$OUT/hierarchy/launch.xml" >/dev/null 2>&1
adb shell am force-stop $PKG

run_flow_soft() {
  local f=$1
  log "flow (not gating) $f"
  ( cd "$OUT/shots" && timeout 300 maestro test --no-ansi --format junit --output "../junit/$(basename "$f" .yaml).xml" "$GITHUB_WORKSPACE/android-tests/flows/$f" ) 2>&1 | tail -30 | tee -a "$OUT/log.txt"
  local rc=${PIPESTATUS[0]}
  mkdir -p "$OUT/maestro"; D=$(ls -dt "$HOME"/.maestro/tests/*/ 2>/dev/null | head -1); [ -n "$D" ] && cp -r "$D" "$OUT/maestro/$(basename "$f" .yaml)" 2>/dev/null || true
  echo "$f rc=$rc" >> "$OUT/soft-flows.txt"
  if [ "$rc" != "0" ]; then adb exec-out screencap -p > "$OUT/shots/SOFTFAIL-$(basename "$f" .yaml).png"; fi
}

run_flow() {
  local f=$1
  log "flow $f"
  ( cd "$OUT/shots" && timeout 420 maestro test --no-ansi --format junit --output "../junit/$(basename "$f" .yaml).xml" "$GITHUB_WORKSPACE/android-tests/flows/$f" ) 2>&1 | tail -40 | tee -a "$OUT/log.txt"
  local rc=${PIPESTATUS[0]}
  mkdir -p "$OUT/maestro"; D=$(ls -dt "$HOME"/.maestro/tests/*/ 2>/dev/null | head -1); [ -n "$D" ] && cp -r "$D" "$OUT/maestro/$(basename "$f" .yaml)" 2>/dev/null || true
  if [ "$rc" != "0" ]; then FAIL=1; log "FLOW FAILED: $f"; adb exec-out screencap -p > "$OUT/shots/FAILED-$(basename "$f" .yaml).png"; fi
}

# upgrade check: install the previous published build ONLY when it has the same package id, then install this build over it
log "upgrade check"
if [ -f "${PREV_APK:-/nonexistent}" ]; then
  PREV_ID=$( (ls "$ANDROID_HOME"/build-tools/*/aapt 2>/dev/null | tail -1 | xargs -I{} {} dump badging "$PREV_APK") 2>/dev/null | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -1)
  echo "previous apk package id: ${PREV_ID:-unreadable}" | tee -a "$OUT/upgrade.txt"
  if [ "$PREV_ID" = "$PKG" ]; then
    adb uninstall $PKG >/dev/null 2>&1
    adb install -r "$PREV_APK" 2>&1 | tee -a "$OUT/upgrade.txt"
    adb install -r "$APK" 2>&1 | tee -a "$OUT/upgrade.txt"
    echo "UPGRADE: attempted previous -> current" >> "$OUT/upgrade.txt"
  else
    echo "UPGRADE: NOT TESTED (previous release has a different package id, so Android treats it as another app)" >> "$OUT/upgrade.txt"
  fi
else
  echo "UPGRADE: NOT TESTED (no previous APK available)" >> "$OUT/upgrade.txt"
fi
adb install -r "$APK" >/dev/null 2>&1

# whole-session screen recording of the main task (the recorder stops at 170 s per file)
adb shell "screenrecord --time-limit 170 /sdcard/main-task.mp4" &
REC=$!
sleep 2
run_flow 02-check-delivery-review-substitution.yaml
adb shell pkill -2 screenrecord; wait $REC 2>/dev/null; sleep 2
adb pull /sdcard/main-task.mp4 "$OUT/main-task.mp4" >/dev/null 2>&1 || log "no recording"

for f in 01-first-run.yaml 04-back-navigation.yaml 07-settings-display.yaml 08-real-kitchen-pin-keyboard.yaml 11-dark-theme-in-app.yaml; do run_flow $f; done
# camera permission flows depend on the Android permission dialog wording of each API level: reported, but they do not fail the job
for f in 03-camera-permission-granted.yaml 09-scan-timeout-and-manual.yaml 10-camera-permission-denied.yaml; do run_flow_soft $f; done

# process death: draft is written, app goes to background, the OS kills the process, then it is relaunched
run_flow 05-draft-write.yaml
sleep 2
adb shell am kill $PKG
sleep 1
adb shell pidof $PKG > "$OUT/pid-after-kill.txt" || echo "process gone" > "$OUT/pid-after-kill.txt"
run_flow 06-draft-restore.yaml

# rotation and relaunch
log "rotation"
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 3
adb exec-out screencap -p > "$OUT/shots/20-landscape.png"
adb shell settings put system user_rotation 0
sleep 1

# cold start time (release build), 5 runs
log "startup"
: > "$OUT/startup.txt"
for i in 1 2 3 4 5; do
  adb shell am force-stop $PKG; sleep 1
  adb shell am start -W -n "$(adb shell cmd package resolve-activity --brief $PKG | tail -1 | tr -d '\r')" | grep -E "TotalTime|WaitTime" | tr -d '\r' | tr '\n' ' ' >> "$OUT/startup.txt"; echo >> "$OUT/startup.txt"
  sleep 2
done

# memory + scrolling jank with the example project
log "memory and scroll"
adb shell am force-stop $PKG
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 4
adb shell dumpsys gfxinfo $PKG reset >/dev/null
for i in 1 2 3 4 5 6; do adb shell input swipe 540 1700 540 500 250; adb shell input swipe 540 500 540 1700 250; done
adb shell dumpsys gfxinfo $PKG | grep -E "Total frames rendered|Janky frames|50th|90th|95th|99th" | tr -d '\r' > "$OUT/scroll-gfxinfo.txt"
adb shell dumpsys meminfo $PKG | grep -E "TOTAL PSS|TOTAL:|Java Heap|Native Heap" | tr -d '\r' | head -5 > "$OUT/meminfo.txt"

adb logcat -d -t 3000 | grep -E "ReactNative|AndroidRuntime|FATAL|$PKG" | tail -200 > "$OUT/logcat-excerpt.txt"
log "done fail=$FAIL"
exit $FAIL
