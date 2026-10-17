#!/usr/bin/env bash
# Runs BEFORE the emulator starts (android-emulator-runner pre-emulator-launch-script).
# Puts a made-up EAN-13 barcode picture on the wall poster of the emulator's virtual camera scene, so a scan of a KNOWN
# synthetic barcode can be tried. Everything is recorded in out/virtual-scene/ so the result can be judged from the evidence.
# Whether the picture is actually in front of the camera, and whether the camera library reads it, is decided by the flow that scans.
set -u
OUTDIR="${GITHUB_WORKSPACE:-.}/out/virtual-scene"
mkdir -p "$OUTDIR"
RES="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/usr/local/lib/android/sdk}}/emulator/resources"
{ echo "resources dir: $RES"; ls -la "$RES" 2>&1 | head -40; } > "$OUTDIR/resources.txt"
POSTERS="$RES/Toren1BD.posters"
if [ ! -f "$POSTERS" ]; then echo "NO POSTERS FILE: virtual scene cannot be edited" > "$OUTDIR/result.txt"; exit 0; fi
cp "$POSTERS" "$OUTDIR/posters-before.txt"
python3 "$(dirname "$0")/make-barcode-poster.py" 501000010014 "$RES/ean-poster.png" > "$OUTDIR/barcode.txt" 2>&1 || { echo "poster image failed" > "$OUTDIR/result.txt"; exit 0; }
python3 - "$POSTERS" <<'PY'
import re, sys
p = sys.argv[1]
t = open(p).read()
blocks = re.split(r"(?m)^(?=poster )", t)
out = []
for b in blocks:
    if b.startswith("poster wall"):
        b = re.sub(r"(?m)^size .*$", "size 1.2 0.67", b)
        b = re.sub(r"(?m)^position .*$", "position 0 -0.1 -1.7", b)
        b = re.sub(r"(?m)^rotation .*$", "rotation 0 0 0", b)
        b = re.sub(r"(?m)^default .*$", "default ean-poster.png", b)
    out.append(b)
open(p, "w").write("".join(out))
PY
cp "$POSTERS" "$OUTDIR/posters-after.txt"
echo "wall poster replaced by EAN-13 $(cat "$OUTDIR/barcode.txt")" > "$OUTDIR/result.txt"
