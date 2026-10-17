import * as Crypto from "expo-crypto";

/**
 * @noble/ciphers needs a CSPRNG at globalThis.crypto.getRandomValues. Hermes may not provide one.
 * We install the OS-backed generator from expo-crypto and FAIL CLOSED if it is unavailable:
 * there is deliberately no Math.random fallback. Must be exercised on real devices (see SECURITY_TESTS.md T-12).
 */
export function installSecureRandom(): void {
  const g = globalThis as unknown as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (typeof g.crypto?.getRandomValues === "function") return;
  if (typeof Crypto.getRandomValues !== "function") {
    throw new Error("No secure random source available; refusing to continue.");
  }
  g.crypto = { ...(g.crypto ?? {}), getRandomValues: (a: Uint8Array) => Crypto.getRandomValues(a) };
}
