import { isValidGtin, normaliseBarcode, type AppState } from "@ingredientalert/core";

/** Barcode types the camera is asked to read. UPC-E and other short forms are deliberately not supported: type the number instead. */
export const SCAN_TYPES = ["ean13", "ean8", "upc_a", "itf14"] as const;
export const SCAN_TIMEOUT_MS = 20_000;

export type ScanOutcome =
  | { kind: "product"; code: string; productId: string; productName: string }
  | { kind: "unknown"; code: string }
  | { kind: "invalid"; code: string; reason: string };

/**
 * What a read (or typed) number means. A barcode is an identifier aid only: it finds a product record, it does not show what is in the pack.
 * Scan errors (a misread digit) are caught by the check digit and are never turned into a product guess.
 */
export function interpretBarcode(s: AppState, tenantId: string, raw: string): ScanOutcome {
  const code = normaliseBarcode(raw);
  if (!code) return { kind: "invalid", code, reason: "Nothing was read." };
  if (!isValidGtin(code)) return { kind: "invalid", code, reason: "This is not a valid barcode number (a digit may be misread, or the code type is not supported)." };
  const p = s.products.find((x) => x.tenantId === tenantId && x.barcodes.includes(code));
  return p ? { kind: "product", code, productId: p.id, productName: p.name } : { kind: "unknown", code };
}
