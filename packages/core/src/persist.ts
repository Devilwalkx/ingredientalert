import { openItem, sealItem, type SealedItem } from "./vault.js";
import { emptyState, type AppState } from "./types.js";

const ITEM = "kitchen-state";

export interface StoredEnvelope { version: number; sealed: SealedItem }

/** Encrypts the whole local database. Ciphertext is bound to account, item and state version. */
export function sealState(key: Uint8Array, state: AppState, accountId: string): StoredEnvelope {
  return { version: state.version, sealed: sealItem(key, JSON.stringify(state), { accountId, itemId: ITEM, version: state.version }) };
}

export function openState(key: Uint8Array, env: StoredEnvelope, accountId: string): AppState {
  const parsed = JSON.parse(openItem(key, env.sealed, { accountId, itemId: ITEM, version: env.version })) as AppState;
  if (parsed.schema !== 1) throw new Error("Unsupported data version");
  for (const k of Object.keys(emptyState()) as Array<keyof AppState>) if (!(k in parsed)) throw new Error("Stored data is incomplete");
  if (parsed.version !== env.version) throw new Error("Stored data version mismatch");
  return parsed;
}
