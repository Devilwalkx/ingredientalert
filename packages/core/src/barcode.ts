/**
 * Barcode helpers. A barcode is an IDENTIFIER AID: it helps find the product record. It is never
 * evidence of what is in the pack, and it cannot see pack variant, batch or recipe changes.
 */
export function normaliseBarcode(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/** GTIN-8/12/13/14 check-digit validation. */
export function isValidGtin(raw: string): boolean {
  const code = normaliseBarcode(raw);
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

/** Append the check digit to a base of 7, 11, 12 or 13 digits (fixtures and tests). */
export function gtinWithCheck(base: string): string {
  if (!/^\d+$/.test(base) || ![7, 11, 12, 13].includes(base.length)) throw new Error("GTIN base must be 7, 11, 12 or 13 digits");
  let sum = 0;
  [...base].reverse().forEach((c, i) => { sum += Number(c) * (i % 2 === 0 ? 3 : 1); });
  return base + String((10 - (sum % 10)) % 10);
}
