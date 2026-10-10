import type { StateStorage } from "zustand/middleware";
import { TryGetPlatform } from "./Platform";

/**
 * Náhrada za původní Store/TauriStorage.ts. Tvar je stejný — jeden „soubor"
 * na store — ale kam se doopravdy zapisuje, rozhoduje až registrovaná
 * platforma.
 *
 * Každá metoda si platformu vyzvedne až při volání (ne při vytvoření), protože
 * `createJSONStorage` si storage vyžádá okamžitě při definici storu, tedy
 * dřív, než root layout stihne RegisterPlatform zavolat.
 *
 * Chyby se polykají stejně jako dřív: bez toho by chybějící bridge (nebo
 * odhlášený uživatel na webu) vyhodil unhandled rejection, ten spustí Next
 * dev overlay a ten zablokuje všechny kliky na stránce.
 */
export function CreatePersistStorage(storeName: string): StateStorage {
  return {
    getItem: async (key) => {
      const platform = TryGetPlatform();
      if (!platform) return null;
      try {
        return await platform.kv.GetItem(storeName, key);
      } catch (error) {
        console.warn(`${storeName}: getItem selhal`, error);
        return null;
      }
    },
    setItem: async (key, value) => {
      const platform = TryGetPlatform();
      if (!platform) return;
      try {
        await platform.kv.SetItem(storeName, key, value);
      } catch (error) {
        console.warn(`${storeName}: setItem selhal`, error);
      }
    },
    removeItem: async (key) => {
      const platform = TryGetPlatform();
      if (!platform) return;
      try {
        await platform.kv.RemoveItem(storeName, key);
      } catch (error) {
        console.warn(`${storeName}: removeItem selhal`, error);
      }
    },
  };
}
