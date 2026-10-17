import type { SecureKeyStore } from "@ingredientalert/core";

/**
 * Web key store. Honest limits: a browser has no Keychain/Keystore. We keep the content key in
 * IndexedDB, encrypted under a NON-EXTRACTABLE WebCrypto AES-GCM key (CryptoKey objects can be
 * stored but their bytes cannot be read by script). This stops casual copying of storage contents,
 * but any script running in the page's origin can still ask the browser to decrypt, and clearing
 * site data destroys the key permanently. The web build is therefore weaker than the native app;
 * the Privacy screen says so, and the recovery secret is the real backup.
 */
const DB = "ingredientalert-keys";
const STORE = "k";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error ?? new Error("IndexedDB failure"));
      t.onabort = () => reject(t.error ?? new Error("IndexedDB aborted"));
    });
  } finally {
    db.close();
  }
}

async function wrapKey(): Promise<CryptoKey> {
  const existing = await tx<CryptoKey | undefined>("readonly", (s) => s.get("wrap"));
  if (existing) return existing;
  const fresh = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await tx("readwrite", (s) => s.put(fresh, "wrap"));
  return (await tx<CryptoKey | undefined>("readonly", (s) => s.get("wrap")))!;
}

export const webKeyStore: SecureKeyStore = {
  async get(name) {
    const rec = await tx<{ iv: Uint8Array; ct: ArrayBuffer } | undefined>("readonly", (s) => s.get(`key:${name}`));
    if (!rec) return null;
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: rec.iv as BufferSource }, await wrapKey(), rec.ct);
    return new Uint8Array(pt);
  },
  async set(name, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await wrapKey(), key as BufferSource);
    await tx("readwrite", (s) => s.put({ iv, ct }, `key:${name}`));
    // Ask the browser not to evict our storage: eviction would destroy the key.
    try {
      await navigator.storage?.persist?.();
    } catch {
      /* best effort */
    }
  },
  async delete(name) {
    await tx("readwrite", (s) => s.delete(`key:${name}`));
  }
};

export const expoKeyStore = webKeyStore;
