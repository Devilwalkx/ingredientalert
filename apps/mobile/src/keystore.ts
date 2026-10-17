import * as SecureStore from "expo-secure-store";
import { bytesToHex, hexToBytes } from "@noble/ciphers/utils.js";
import type { SecureKeyStore } from "@ingredientalert/core";

/**
 * Keys live in the iOS Keychain / Android Keystore-backed store, this-device-only
 * (not synced to iCloud/backups). Never AsyncStorage, never logs.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};

export const expoKeyStore: SecureKeyStore = {
  async get(name) {
    const v = await SecureStore.getItemAsync(`ia.key.${name}`, OPTIONS);
    return v ? hexToBytes(v) : null;
  },
  async set(name, key) {
    await SecureStore.setItemAsync(`ia.key.${name}`, bytesToHex(key), OPTIONS);
  },
  async delete(name) {
    await SecureStore.deleteItemAsync(`ia.key.${name}`, OPTIONS);
  }
};
