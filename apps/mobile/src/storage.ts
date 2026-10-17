import { File, Paths } from "expo-file-system";

/**
 * Local storage for ciphertext and non-secret settings. Native: files in the app's private document
 * folder (no storage permission needed; other apps cannot read it). A `storage.web.ts` sibling is used on web.
 * Only ciphertext and non-secret settings are ever written here. Keys live in the secure key store.
 */
export interface KeyValueStore {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
}

const file = (name: string) => new File(Paths.document, `${name}.json`);

export const storage: KeyValueStore = {
  async get(name) {
    const f = file(name);
    return f.exists ? await f.text() : null;
  },
  async set(name, value) {
    const f = file(name);
    if (!f.exists) f.create();
    f.write(value);
  },
  async delete(name) {
    const f = file(name);
    if (f.exists) f.delete();
  }
};
