#!/usr/bin/env python3
"""Writes a PNG of an EAN-13 barcode (a made-up synthetic number) for the emulator's virtual camera scene.
Usage: make-barcode-poster.py <12-digit base> <out.png>   (the check digit is added). Pure Python, no libraries."""
import sys, zlib, struct
L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"]
G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"]
R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"]
PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"]
def check(base):
    s = sum(int(c) * (3 if i % 2 == 0 else 1) for i, c in enumerate(reversed(base)))
    return str((10 - s % 10) % 10)
def ean13(base):
    code = base + check(base)
    first, left, right = int(code[0]), code[1:7], code[7:]
    bits = "101"
    for d, p in zip(left, PARITY[first]): bits += (L if p == "L" else G)[int(d)]
    bits += "01010"
    for d in right: bits += R[int(d)]
    return code, bits + "101"
def png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    def chunk(t, d): c = struct.pack(">I", len(d)) + t + d; return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
base, out = sys.argv[1], sys.argv[2]
code, bits = ean13(base)
module, quiet, height = 8, 11 * 8, 520
width = (len(bits) + 22) * module
row = bytearray([255] * width)
for i, b in enumerate(bits):
    if b == "1":
        for x in range((11 + i) * module, (12 + i) * module): row[x] = 0
png(out, width, height, [bytes(row)] * height)
print(code)
