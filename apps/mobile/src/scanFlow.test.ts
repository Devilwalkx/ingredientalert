import { describe, expect, it } from "vitest";
import { baseState, barcodeOf, gtinWithCheck } from "@ingredientalert/core";
import { interpretBarcode, SCAN_TYPES, SCAN_TIMEOUT_MS } from "./scanFlow";

describe("scan result handling", () => {
  const s = baseState();
  it("finds a product for a known valid barcode", () => {
    const r = interpretBarcode(s, "tenant-1", barcodeOf("p-flour"));
    expect(r).toMatchObject({ kind: "product", productId: "p-flour" });
  });
  it("accepts spaces and dashes in typed numbers", () => {
    const code = barcodeOf("p-rice");
    expect(interpretBarcode(s, "tenant-1", `${code.slice(0, 3)} ${code.slice(3, 8)}-${code.slice(8)}`)).toMatchObject({ kind: "product", productId: "p-rice" });
  });
  it("valid but unknown number is 'unknown', not a guess", () => {
    expect(interpretBarcode(s, "tenant-1", gtinWithCheck("501999999991"))).toMatchObject({ kind: "unknown" });
  });
  it("a misread digit fails the check digit and is 'invalid'", () => {
    const good = barcodeOf("p-flour");
    const bad = good.slice(0, 5) + String((Number(good[5]) + 1) % 10) + good.slice(6);
    expect(interpretBarcode(s, "tenant-1", bad)).toMatchObject({ kind: "invalid" });
  });
  it("empty or non-numeric reads are invalid", () => {
    expect(interpretBarcode(s, "tenant-1", "")).toMatchObject({ kind: "invalid" });
    expect(interpretBarcode(s, "tenant-1", "ABC123")).toMatchObject({ kind: "invalid" });
  });
  it("never matches another kitchen's product", () => {
    expect(interpretBarcode(s, "tenant-1", s.products.find((p) => p.id === "p2-flour")!.barcodes[0]!)).toMatchObject({ kind: "unknown" });
  });
  it("scan configuration: supported types and a finite timeout", () => {
    expect(SCAN_TYPES).toContain("ean13");
    expect(SCAN_TIMEOUT_MS).toBeGreaterThan(5000);
  });
});
