/**
 * Tenká obálka nad IndexedDB pro anonymní režim.
 *
 * Proč ne localStorage: má strop kolem 5 MB a umí jen řetězce. LockIn ukládá
 * Tiptap dokumenty a k tomu obrázky a videa — to se tam nevejde. IndexedDB
 * bere Bloby přímo a limit je řádově vyšší.
 *
 * Žádná knihovna — jsou to čtyři operace nad třemi object story a idb/dexie
 * by za to nestály.
 */

const DB_NAME = "lockin";
const DB_VERSION = 1;

export const STORE_DOCUMENTS = "documents";
export const STORE_PROJECTS = "projects";
export const STORE_MEDIA = "media";
export const STORE_KV = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function OpenDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of [STORE_DOCUMENTS, STORE_PROJECTS, STORE_MEDIA, STORE_KV]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function Run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return OpenDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const request = operation(transaction.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export function DbGet<T>(store: string, key: string): Promise<T | undefined> {
  return Run<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function DbPut(store: string, key: string, value: unknown): Promise<IDBValidKey> {
  return Run(store, "readwrite", (s) => s.put(value, key));
}

export function DbDelete(store: string, key: string): Promise<undefined> {
  return Run(store, "readwrite", (s) => s.delete(key) as IDBRequest<undefined>);
}

export function DbGetAll<T>(store: string): Promise<T[]> {
  return Run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}

export function DbGetAllKeys(store: string): Promise<string[]> {
  return Run<IDBValidKey[]>(store, "readonly", (s) => s.getAllKeys()).then((keys) =>
    keys.map(String),
  );
}

export function DbClear(store: string): Promise<undefined> {
  return Run(store, "readwrite", (s) => s.clear() as IDBRequest<undefined>);
}

/** Je vůbec IndexedDB k dispozici? V privátním okně některých prohlížečů ne. */
export function IsAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
