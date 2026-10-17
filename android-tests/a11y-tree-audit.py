#!/usr/bin/env python3
"""Reads a `uiautomator dump` of the screen currently shown and reports problems in the accessibility tree that a screen reader would meet.
This is NOT a TalkBack run. It checks only: (1) every clickable/checkable element has a name (own text/content-desc or a descendant's),
(2) every clickable element is at least 48dp in both directions, (3) the number of elements a reader can focus, in reading (document) order.
Usage: a11y-tree-audit.py dump.xml density_dpi label  -> prints a JSON line"""
import sys, json, re
import xml.etree.ElementTree as ET
xml, dpi, label = sys.argv[1], int(sys.argv[2]), sys.argv[3]
px48 = round(48 * dpi / 160)
root = ET.parse(xml).getroot()
def bounds(n):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.get("bounds", ""))
    return tuple(map(int, m.groups())) if m else None
def named(n):
    if (n.get("text") or "").strip() or (n.get("content-desc") or "").strip(): return True
    return any(named(c) for c in n)
unnamed, small, focusables, names = [], [], 0, []
def walk(n):
    global focusables
    b = bounds(n)
    interactive = n.get("clickable") == "true" or n.get("checkable") == "true"
    if interactive and b:
        w, h = b[2]-b[0], b[3]-b[1]
        txt = (n.get("text") or n.get("content-desc") or "").strip()
        focusables += 1
        if not named(n): unnamed.append({"class": n.get("class"), "bounds": n.get("bounds")})
        if (w < px48 or h < px48) and w > 0 and h > 0: small.append({"name": txt[:40], "w_px": w, "h_px": h, "min_px": px48})
        names.append(txt[:40])
    for c in n: walk(c)
walk(root)
print(json.dumps({"screen": label, "density_dpi": dpi, "min_target_px": px48, "interactive_elements": focusables,
                  "unnamed_interactive": unnamed, "undersized_interactive": small, "reading_order_names": names}))
