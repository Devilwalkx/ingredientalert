import { describe, expect, it } from "vitest";
import { encryptionSelfCheck, type SecureKeyStore } from "../src/index.js";

function memoryStore(): SecureKeyStore & { size(): number } {
  const m = new Map<string, Uint8Array>();
  return { async get(n) { return m.get(n) ?? null; }, async set(n, k) { m.set(n, k); }, async delete(n) { m.delete(n); }, size: () => m.size };
}

describe("encryption self-check", () => {
  it("passes against a working key store and removes its temporary key", async () => {
    const s = memoryStore();
    const r = await encryptionSelfCheck(s);
    expect(r.ok).toBe(true);
    expect(r.steps.length).toBe(6);
    expect(s.size()).toBe(0);
  });
  it("fails if the key store hands back a different key than was saved", async () => {
    const s = memoryStore();
    const bad: SecureKeyStore = { ...s, async get() { return new Uint8Array(32); } };
    expect((await encryptionSelfCheck(bad)).ok).toBe(false);
  });
  it("fails (does not throw) if the key store is broken", async () => {
    const broken: SecureKeyStore = { async get() { throw new Error("x"); }, async set() { throw new Error("x"); }, async delete() { /* */ } };
    const r = await encryptionSelfCheck(broken);
    expect(r.ok).toBe(false);
  });
});
