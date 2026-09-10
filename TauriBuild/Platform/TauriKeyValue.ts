import { LazyStore } from "@tauri-apps/plugin-store";
import type { KeyValueAdapter } from "@lockin/shared/Platform/Types";

/**
 * `KeyValueAdapter` nad tauri-plugin-store — každý logický store je vlastní
 * soubor v AppData, stejně jako dřív ve Store/TauriStorage.ts.
 *
 * LazyStore instance se drží v cache podle jména, aby se pro jeden soubor
 * nevytvářely opakovaně.
 */
const stores = new Map<string, LazyStore>();

function GetStore(name: string): LazyStore {
  let store = stores.get(name);
  if (!store) {
    store = new LazyStore(name);
    stores.set(name, store);
  }
  return store;
}

export const TauriKeyValue: KeyValueAdapter = {
  async GetItem(storeName, key) {
    const value = await GetStore(storeName).get<string>(key);
    return value ?? null;
  },

  async SetItem(storeName, key, value) {
    const store = GetStore(storeName);
    await store.set(key, value);
    await store.save();
  },

  async RemoveItem(storeName, key) {
    const store = GetStore(storeName);
    await store.delete(key);
    await store.save();
  },
};
