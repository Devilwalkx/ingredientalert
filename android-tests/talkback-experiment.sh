#!/usr/bin/env bash
# EXPERIMENT (not gating): turn on the real TalkBack that ships on some emulator images, move through the app with keyboard focus keys,
# and record what TalkBack reports. This is NOT a usability test with a screen-reader user and does not establish that TalkBack users can use the app.
# Needs: PKG, OUT. Writes $OUT/talkback/*.
set -u
TB=com.google.android.marvin.talkback
mkdir -p "$OUT/talkback"
if ! adb shell pm list packages | tr -d '\r' | grep -q "package:$TB$"; then echo "TalkBack is not installed on this emulator image: NOT TESTED" | tee "$OUT/talkback/result.txt"; exit 0; fi
adb logcat -c
adb shell settings put secure enabled_accessibility_services "$TB/com.google.android.marvin.talkback.TalkBackService"
adb shell settings put secure accessibility_enabled 1
sleep 20
adb shell dumpsys accessibility | tr -d '\r' | grep -iE "enabled|Service\[|talkback" | head -20 > "$OUT/talkback/dumpsys-accessibility.txt"
adb exec-out screencap -p > "$OUT/talkback/00-talkback-on.png"
adb shell input keyevent KEYCODE_BACK; sleep 2
adb shell am force-stop $PKG; sleep 1
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 10
adb exec-out screencap -p > "$OUT/talkback/01-app-with-talkback.png"
for i in 1 2 3 4 5 6 7 8; do
  adb shell input keyevent KEYCODE_TAB; sleep 2
  adb exec-out screencap -p > "$OUT/talkback/02-focus-$i.png"
done
adb shell uiautomator dump /sdcard/tb.xml >/dev/null 2>&1; adb pull /sdcard/tb.xml "$OUT/talkback/tree-with-talkback.xml" >/dev/null 2>&1
adb logcat -d | grep -iE "talkback|marvin|Utterance|speak|SpeechController|Feedback" | head -400 > "$OUT/talkback/logcat-talkback.txt"
adb shell settings put secure enabled_accessibility_services ""
adb shell settings put secure accessibility_enabled 0
echo "TalkBack was installed and switched on for the duration of this experiment; screenshots and its log lines are recorded. No judgement about usability is made." | tee "$OUT/talkback/result.txt"
