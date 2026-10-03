/**
 * lib/db.ts — central persistence layer for OmniToolBox.
 *
 * One IndexedDB database ("omnitoolbox", version 1) with two stores:
 *   - `blobs`   : { id, kind, name, mime, blob, createdAt, meta? }   (keyPath "id")
 *   - `records` : { id, kind, data, createdAt }                        (keyPath "id")
 *
 * Blobs are heavy binary outputs (MP3s, QR PNGs, converted images…).
 * Records are small JSON payloads (history metadata, settings…).
 *
 * Graceful degradation:
 *   - If IndexedDB is unavailable, every blob call resolves safely
 *     (save → null, get → null, list → [], deletes are no-ops). Never throws.
 *   - Records fall back to localStorage, namespaced `otb:records:<kind>:<id>`.
 */

export interface BlobMeta {
  id: string;
  kind: string;
  name: string;
  createdAt: number;
  meta?: Record<string, unknown>;
}

export interface BlobData {
  blob: Blob;
  mime: string;
  name: string;
  meta?: Record<string, unknown>;
}

export interface RecordEntry<T = unknown> {
  id: string;
  kind: string;
  data: T;
  createdAt: number;
}

interface RawBlobRow {
  id: string;
  kind: string;
  name: string;
  mime: string;
  blob: Blob;
  createdAt: number;
  meta?: Record<string, unknown>;
}

const DB_NAME = "omnitoolbox";
const DB_VERSION = 1;
const LS_RECORD_PREFIX = "otb:records:";

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!idbAvailable()) return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs", { keyPath: "id" });
          if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          dbPromise = null;
          reject(req.error);
        };
        req.onblocked = () => {
          /* another tab holds the db open — proceed when it releases */
        };
      } catch (e) {
        dbPromise = null;
        reject(e);
      }
    });
  }
  return dbPromise;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let req: IDBRequest;
        try {
          const t = db.transaction(store, mode);
          req = fn(t.objectStore(store));
        } catch (e) {
          reject(e);
          return;
        }
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      })
  );
}

function lsRecordKey(kind: string, id: string): string {
  return `${LS_RECORD_PREFIX}${kind}:${id}`;
}

/* ---------------- Blobs ---------------- */

/** Persist a blob. Resolves to the new id, or null when IndexedDB is unavailable. */
export async function saveBlob(
  kind: string,
  blob: Blob,
  name: string,
  meta?: Record<string, unknown>
): Promise<string | null> {
  if (!idbAvailable()) return null;
  const id = makeId();
  const row: RawBlobRow = {
    id,
    kind,
    name,
    mime: blob.type || "application/octet-stream",
    blob,
    createdAt: Date.now(),
    ...(meta ? { meta } : {}),
  };
  try {
    await run<unknown>("blobs", "readwrite", (s) => s.put(row));
    return id;
  } catch {
    return null;
  }
}

/** Fetch a blob entry. Never throws — resolves null when missing/unavailable. */
export async function getBlob(id: string): Promise<BlobData | null> {
  if (!idbAvailable()) return null;
  try {
    const row = await run<RawBlobRow | undefined>("blobs", "readonly", (s) => s.get(id));
    if (!row || !row.blob) return null;
    return { blob: row.blob, mime: row.mime, name: row.name, meta: row.meta };
  } catch {
    return null;
  }
}

export async function deleteBlob(id: string): Promise<void> {
  if (!idbAvailable()) return;
  try {
    await run<unknown>("blobs", "readwrite", (s) => s.delete(id));
  } catch {
    /* no-op */
  }
}

/**
 * List metadata for one kind (no blob bytes — cursor scan, newest first).
 * Never throws.
 */
export async function listByKind(kind: string, limit = 100): Promise<BlobMeta[]> {
  if (!idbAvailable()) return [];
  try {
    const out: BlobMeta[] = [];
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("blobs", "readonly");
      const cursorReq = t.objectStore("blobs").openCursor();
      cursorReq.onsuccess = () => {
        const c = cursorReq.result;
        if (!c) {
          resolve();
          return;
        }
        const row = c.value as RawBlobRow;
        if (row.kind === kind) {
          const { blob: _blob, ...rest } = row;
          out.push(rest);
        }
        c.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out.slice(0, limit);
  } catch {
    return [];
  }
}

/** All kinds that currently have at least one blob. Never throws. */
export async function listBlobKinds(): Promise<string[]> {
  if (!idbAvailable()) return [];
  try {
    const kinds = new Set<string>();
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("blobs", "readonly");
      const cursorReq = t.objectStore("blobs").openCursor();
      cursorReq.onsuccess = () => {
        const c = cursorReq.result;
        if (!c) {
          resolve();
          return;
        }
        kinds.add((c.value as RawBlobRow).kind);
        c.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    return [...kinds];
  } catch {
    return [];
  }
}

/** Delete every blob of one kind. Never throws. */
export async function clearKind(kind: string): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("blobs", "readwrite");
      const store = t.objectStore("blobs");
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const c = cursorReq.result;
        if (!c) {
          resolve();
          return;
        }
        if ((c.value as RawBlobRow).kind === kind) c.delete();
        c.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch {
    /* no-op */
  }
}

/* ---------------- Records (small JSON) ---------------- */

/** Persist a small JSON record. Falls back to localStorage when IDB is unavailable. */
export async function saveRecord<T>(kind: string, data: T): Promise<string | null> {
  const id = makeId();
  const entry: RecordEntry<T> = { id, kind, data, createdAt: Date.now() };
  if (!idbAvailable()) {
    try {
      localStorage.setItem(lsRecordKey(kind, id), JSON.stringify(entry));
      return id;
    } catch {
      return null;
    }
  }
  try {
    await run<unknown>("records", "readwrite", (s) => s.put(entry));
    return id;
  } catch {
    try {
      localStorage.setItem(lsRecordKey(kind, id), JSON.stringify(entry));
      return id;
    } catch {
      return null;
    }
  }
}

export async function getRecord<T = unknown>(id: string): Promise<RecordEntry<T> | null> {
  if (!idbAvailable()) {
    // Scan localStorage for the id across kinds.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LS_RECORD_PREFIX) && k.endsWith(`:${id}`)) {
          const raw = localStorage.getItem(k);
          return raw ? (JSON.parse(raw) as RecordEntry<T>) : null;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  }
  try {
    const row = await run<RecordEntry<T> | undefined>("records", "readonly", (s) => s.get(id));
    return row ?? null;
  } catch {
    return null;
  }
}

/** All records of one kind, newest first. Falls back to localStorage scan. Never throws. */
export async function listRecords<T = unknown>(kind: string): Promise<RecordEntry<T>[]> {
  const out: RecordEntry<T>[] = [];
  const seen = new Set<string>();
  const push = (e: RecordEntry<T>) => {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  };
  if (idbAvailable()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const t = db.transaction("records", "readonly");
        const cursorReq = t.objectStore("records").openCursor();
        cursorReq.onsuccess = () => {
          const c = cursorReq.result;
          if (!c) {
            resolve();
            return;
          }
          const row = c.value as RecordEntry<T>;
          if (row.kind === kind) push(row);
          c.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } catch {
      /* fall through to localStorage scan */
    }
  }
  // localStorage fallback entries (namespaced otb:records:<kind>:<id>)
  try {
    const prefix = `${LS_RECORD_PREFIX}${kind}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            push(JSON.parse(raw) as RecordEntry<T>);
          } catch {
            /* skip corrupt entry */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

/* ---------------- Named records (settings, overrides, admin blog) ----------------
 * Small JSON documents addressed by (kind, id) with a localStorage mirror so
 * admin changes survive and apply instantly even if IndexedDB is blocked.
 * Never throws.
 */

const LS_NAMED_PREFIX = "otb:named:";

function lsNamedKey(kind: string, id: string): string {
  return `${LS_NAMED_PREFIX}${kind}:${id}`;
}

/** Persist a named JSON record. Writes IDB (records store) + localStorage backup. */
export async function saveNamedRecord<T>(kind: string, id: string, data: T): Promise<void> {
  try {
    localStorage.setItem(lsNamedKey(kind, id), JSON.stringify({ id, kind, data, createdAt: Date.now() }));
  } catch {
    /* storage unavailable — IDB may still work */
  }
  if (!idbAvailable()) return;
  try {
    const entry: RecordEntry<T> = { id, kind, data, createdAt: Date.now() };
    await run<unknown>("records", "readwrite", (s) => s.put(entry));
  } catch {
    /* IDB write failed — localStorage backup already written */
  }
}

/** Read a named JSON record. Checks IDB first, then localStorage. Never throws. */
export async function getNamedRecord<T>(kind: string, id: string): Promise<T | null> {
  if (idbAvailable()) {
    try {
      const row = await run<RecordEntry<T> | undefined>("records", "readonly", (s) => s.get(id));
      if (row && row.kind === kind) return row.data;
    } catch {
      /* fall through to localStorage */
    }
  }
  try {
    const raw = localStorage.getItem(lsNamedKey(kind, id));
    if (raw) return (JSON.parse(raw) as RecordEntry<T>).data;
  } catch {
    /* ignore */
  }
  return null;
}

/** Delete a named JSON record from IDB + localStorage. Never throws. */
export async function deleteNamedRecord(kind: string, id: string): Promise<void> {
  try {
    localStorage.removeItem(lsNamedKey(kind, id));
  } catch {
    /* ignore */
  }
  if (!idbAvailable()) return;
  try {
    await run<unknown>("records", "readwrite", (s) => s.delete(id));
  } catch {
    /* no-op */
  }
}

/** All named records of one kind (IDB + localStorage mirrors merged). Never throws. */
export async function listNamedRecords<T>(kind: string): Promise<RecordEntry<T>[]> {
  const map = new Map<string, RecordEntry<T>>();
  if (idbAvailable()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const t = db.transaction("records", "readonly");
        const cursorReq = t.objectStore("records").openCursor();
        cursorReq.onsuccess = () => {
          const c = cursorReq.result;
          if (!c) {
            resolve();
            return;
          }
          const row = c.value as RecordEntry<T>;
          if (row.kind === kind && !map.has(row.id)) map.set(row.id, row);
          c.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } catch {
      /* fall through */
    }
  }
  try {
    const prefix = `${LS_NAMED_PREFIX}${kind}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const entry = JSON.parse(raw) as RecordEntry<T>;
            if (!map.has(entry.id)) map.set(entry.id, entry);
          } catch {
            /* skip corrupt entry */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
}
