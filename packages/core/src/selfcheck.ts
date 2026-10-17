import { bytesToHex, randomBytes } from "@noble/ciphers/utils.js";
import { generateContentKey, openItem, sealItem, type SecureKeyStore } from "./vault.js";

export interface SelfCheckStep { label: string; ok: boolean }
export interface SelfCheckResult { ok: boolean; steps: SelfCheckStep[] }

const TEMP_KEY = "selfcheck-temp";

/**
 * Runs the real encryption code against the real key store of the platform it is running on, with made-up data.
 * It shows content to nobody and leaves nothing behind (the temporary key is deleted).
 * It establishes: this build can store a key, encrypt, decrypt, and refuses tampered or mis-addressed ciphertext.
 * It does not establish anything about the strength of the algorithm or about the data you already hold.
 */
export async function encryptionSelfCheck(store: SecureKeyStore): Promise<SelfCheckResult> {
  const steps: SelfCheckStep[] = [];
  const add = (label: string, ok: boolean) => steps.push({ label, ok });
  try {
    const key = generateContentKey();
    await store.set(TEMP_KEY, key);
    const back = await store.get(TEMP_KEY);
    add("A key was saved in the phone's protected storage and read back unchanged", !!back && bytesToHex(back) === bytesToHex(key));
    const ctx = { accountId: "selfcheck", itemId: "item", version: 1 };
    const text = `selfcheck-${bytesToHex(randomBytes(8))}`;
    const sealed = back ? sealItem(back, text, ctx) : null;
    add("Made-up text was encrypted, and the stored form does not contain the text", !!sealed && !sealed.ct.includes(bytesToHex(new TextEncoder().encode(text))));
    add("The encrypted text opens again with the same key", !!sealed && !!back && openItem(back, sealed, ctx) === text);
    const refuses = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };
    if (sealed && back) {
      const flipped = { ...sealed, ct: (sealed.ct.slice(0, 4) + (sealed.ct[4] === "0" ? "1" : "0")) + sealed.ct.slice(5) };
      add("One changed character in the encrypted text is refused", refuses(() => openItem(back, flipped, ctx)));
      add("The same text offered for a different item is refused", refuses(() => openItem(back, sealed, { ...ctx, itemId: "other" })));
      add("A different key is refused", refuses(() => openItem(generateContentKey(), sealed, ctx)));
    } else {
      add("One changed character in the encrypted text is refused", false);
    }
  } catch {
    add("The check could not run to the end", false);
  } finally {
    try { await store.delete(TEMP_KEY); } catch { /* nothing to delete */ }
  }
  return { ok: steps.length > 0 && steps.every((s) => s.ok), steps };
}
