import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes, bytesToUtf8 } from "@noble/ciphers/utils.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

/**
 * Private vault for the local kitchen data (encrypted at rest on this device).
 *
 * - No custom primitives: XChaCha20-Poly1305 (authenticated, 192-bit random nonces) and
 *   HKDF-SHA256 from the audited @noble libraries. Composition still needs independent review.
 * - Content keys are generated on-device with a CSPRNG and never leave it in the clear.
 * - Ciphertext is bound to account/item/version through AAD, so a blob cannot be swapped
 *   between items, accounts or versions without failing authentication.
 * - There is no plaintext fallback: every failure throws.
 * - Recovery is a user-held 256-bit secret. A password reset has no key material and cannot decrypt.
 */

const DOMAIN = "ingredientalert/v1";
const KEY_BYTES = 32;
const NONCE_BYTES = 24;

export interface ItemContext {
  accountId: string;
  itemId: string;
  /** Monotonic version of the item; prevents rollback to an older ciphertext being accepted as current. */
  version: number;
}

export interface SealedItem {
  v: 1;
  alg: "xchacha20poly1305";
  nonce: string; // hex
  ct: string; // hex
}

/** Platform secure storage (iOS Keychain / Android Keystore) behind an interface. Never AsyncStorage. */
export interface SecureKeyStore {
  get(name: string): Promise<Uint8Array | null>;
  set(name: string, key: Uint8Array): Promise<void>;
  delete(name: string): Promise<void>;
}

function assertKey(key: Uint8Array): void {
  if (!(key instanceof Uint8Array) || key.length !== KEY_BYTES) throw new Error("Vault key must be 32 bytes");
}

function aad(domainPart: string, ...parts: Array<string | number>): Uint8Array {
  return utf8ToBytes(JSON.stringify([DOMAIN, domainPart, ...parts]));
}

export function generateContentKey(): Uint8Array {
  return randomBytes(KEY_BYTES);
}

export function sealItem(key: Uint8Array, plaintext: string, ctx: ItemContext): SealedItem {
  assertKey(key);
  const nonce = randomBytes(NONCE_BYTES);
  const ct = xchacha20poly1305(key, nonce, aad("item", ctx.accountId, ctx.itemId, ctx.version)).encrypt(utf8ToBytes(plaintext));
  return { v: 1, alg: "xchacha20poly1305", nonce: bytesToHex(nonce), ct: bytesToHex(ct) };
}

export function openItem(key: Uint8Array, sealed: SealedItem, ctx: ItemContext): string {
  assertKey(key);
  if (sealed.v !== 1 || sealed.alg !== "xchacha20poly1305") throw new Error("Unsupported envelope");
  const pt = xchacha20poly1305(key, hexToBytes(sealed.nonce), aad("item", ctx.accountId, ctx.itemId, ctx.version)).decrypt(hexToBytes(sealed.ct));
  return bytesToUtf8(pt);
}

// ---- Recovery ---------------------------------------------------------------------------

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 256-bit secret shown once to the user, as 13 groups of 4 Crockford base32 characters. */
export function generateRecoverySecret(): { secret: Uint8Array; display: string } {
  const secret = randomBytes(KEY_BYTES);
  return { secret, display: encodeRecoverySecret(secret) };
}

export function encodeRecoverySecret(secret: Uint8Array): string {
  if (secret.length !== KEY_BYTES) throw new Error("Recovery secret must be 32 bytes");
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const b of secret) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += CROCKFORD[(acc << (5 - bits)) & 31];
  return out.match(/.{1,4}/g)!.join("-");
}

export function decodeRecoverySecret(display: string): Uint8Array {
  const cleaned = display.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  const out: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const ch of cleaned) {
    const v = CROCKFORD.indexOf(ch);
    if (v < 0) throw new Error("Invalid recovery secret character");
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((acc >>> (bits - 8)) & 255);
      bits -= 8;
    }
    acc &= (1 << bits) - 1;
  }
  if (out.length !== KEY_BYTES) throw new Error("Recovery secret has wrong length");
  return Uint8Array.from(out);
}

export interface RecoveryBlob {
  v: 1;
  nonce: string;
  ct: string;
}

function recoveryWrapKey(secret: Uint8Array, accountId: string): Uint8Array {
  // The secret is already 256-bit random, so HKDF (not a password KDF) is the right tool.
  return hkdf(sha256, secret, utf8ToBytes(accountId), utf8ToBytes(`${DOMAIN}/recovery-wrap`), KEY_BYTES);
}

export function wrapKeyForRecovery(contentKey: Uint8Array, recoverySecret: Uint8Array, accountId: string): RecoveryBlob {
  assertKey(contentKey);
  assertKey(recoverySecret);
  const nonce = randomBytes(NONCE_BYTES);
  const ct = xchacha20poly1305(recoveryWrapKey(recoverySecret, accountId), nonce, aad("recovery", accountId)).encrypt(contentKey);
  return { v: 1, nonce: bytesToHex(nonce), ct: bytesToHex(ct) };
}

export function unwrapKeyFromRecovery(blob: RecoveryBlob, recoverySecret: Uint8Array, accountId: string): Uint8Array {
  assertKey(recoverySecret);
  if (blob.v !== 1) throw new Error("Unsupported recovery blob");
  return xchacha20poly1305(recoveryWrapKey(recoverySecret, accountId), hexToBytes(blob.nonce), aad("recovery", accountId)).decrypt(hexToBytes(blob.ct));
}
