const FLAG = "cvcm.session";
const DB_NAME = "cvcm";
const STORE = "drafts";

export function sessionLive(): boolean {
  try {
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function markSession(): void {
  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    /* private mode */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function runWrite(db: IDBDatabase, op: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      // Quota failures often only abort the transaction.
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      op(tx.objectStore(STORE));
    } catch (err) {
      reject(err);
    }
  });
}

export async function saveDraft(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await runWrite(db, (store) => store.put(value, key));
  } finally {
    db.close();
  }
}

/** Null when there is no draft or IndexedDB is unavailable (some private modes): a tool must still open. */
export async function loadDraft<T>(key: string): Promise<T | null> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }
  const value = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

export async function clearDraft(key: string): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return;
  }
  try {
    await runWrite(db, (store) => store.delete(key));
  } finally {
    db.close();
  }
}

export function debounce(fn: () => void, ms: number): () => void {
  let timer = 0;
  return () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(fn, ms);
  };
}
