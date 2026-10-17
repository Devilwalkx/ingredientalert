import { scrypt } from "@noble/hashes/scrypt.js";
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from "@noble/ciphers/utils.js";

/**
 * Short per-person PIN for a shared kitchen device.
 *
 * WHAT IT IS: a quick re-authentication so each action is attributed to the person who is actually holding the device.
 * WHAT IT IS NOT: it does not encrypt the data (the device key does that), and a 4-6 digit PIN has very little entropy, so
 * anyone who can copy the stored data off a rooted device can try every PIN offline. The slow hash only raises the cost of that.
 * The throttle (`lockoutMs`) slows guessing on the device itself.
 */
export interface PinRecord { salt: string; hash: string; n: number }

/** scrypt cost. Chosen to stay responsive on a modest tablet in JavaScript; real-device timing is NOT measured. */
export const PIN_SCRYPT_N = 4096;

export function validatePin(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return "Use 4 to 6 digits.";
  if (/^(\d)\1+$/.test(pin)) return "Do not repeat one digit (like 0000 or 1111).";
  const d = [...pin].map(Number);
  const step = d[1]! - d[0]!;
  if ((step === 1 || step === -1) && d.every((x, i) => i === 0 || x - d[i - 1]! === step)) return "Do not use a run of digits (like 1234 or 4321).";
  return null;
}

function derive(pin: string, salt: Uint8Array, n: number): string {
  return bytesToHex(scrypt(utf8ToBytes(pin), salt, { N: n, r: 8, p: 1, dkLen: 32 }));
}

export function makePinRecord(pin: string): PinRecord {
  const bad = validatePin(pin);
  if (bad) throw new Error(bad);
  const salt = randomBytes(16);
  return { salt: bytesToHex(salt), hash: derive(pin, salt, PIN_SCRYPT_N), n: PIN_SCRYPT_N };
}

export function checkPin(rec: PinRecord, pin: string): boolean {
  if (!/^\d{4,6}$/.test(pin)) return false;
  const got = derive(pin, hexToBytes(rec.salt), rec.n);
  // constant-time style comparison
  let diff = got.length ^ rec.hash.length;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ (rec.hash.charCodeAt(i) || 0);
  return diff === 0;
}

/** Wait before the next attempt is allowed, after `failures` wrong PINs in a row. */
export function lockoutMs(failures: number): number {
  if (failures < 3) return 0;
  if (failures < 5) return 30_000;
  if (failures < 8) return 5 * 60_000;
  return 15 * 60_000;
}
