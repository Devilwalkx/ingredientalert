/**
 * Browsers only expose WebCrypto and secure storage APIs in secure contexts (HTTPS or localhost).
 * Without them we refuse to run rather than fall back to storing anything unprotected.
 */
export function platformBlocker(): string | null {
  const g = globalThis as unknown as { isSecureContext?: boolean; crypto?: { subtle?: unknown }; indexedDB?: unknown };
  if (!g.crypto?.subtle || !g.indexedDB || g.isSecureContext === false) {
    return "This page is not served over HTTPS (or this browser blocks storage), so private storage is disabled. Open the HTTPS address, or use the Android app.";
  }
  return null;
}
