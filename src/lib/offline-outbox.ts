// Client-side IndexedDB outbox for lesson-progress writes that happen while
// offline. Writes try the server action first; on network failure, they
// enqueue here and replay on reconnect via /api/offline-sync.
//
// Design is deliberately dependency-free — no `idb` lib. The surface is
// small: enqueue, drain, count. Swap to `idb` later if the ergonomics hurt.

export type OutboxKind = "start" | "complete";

export interface OutboxEntry {
  id: string;
  kind: OutboxKind;
  enrollmentId: string;
  lessonId: string;
  courseSlug: string;
  lang: string;
  clientTimestamp: number;
  queuedAt: number;
  attempts: number;
}

const DB_NAME = "wanderlearn-offline";
const DB_VERSION = 1;
const STORE_NAME = "progress_outbox";

function isBrowser(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueProgressWrite(
  entry: Omit<OutboxEntry, "id" | "queuedAt" | "attempts">,
): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  const full: OutboxEntry = {
    ...entry,
    id: genId(),
    queuedAt: Date.now(),
    attempts: 0,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(full);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getPendingCount(): Promise<number> {
  if (!isBrowser()) return 0;
  const db = await openDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function readAll(): Promise<OutboxEntry[]> {
  if (!isBrowser()) return [];
  const db = await openDb();
  try {
    return await new Promise<OutboxEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as OutboxEntry[]);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function deleteIds(ids: string[]): Promise<void> {
  if (!isBrowser() || ids.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    for (const id of ids) tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function bumpAttempts(ids: string[]): Promise<void> {
  if (!isBrowser() || ids.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const id of ids) {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const row = getReq.result as OutboxEntry | undefined;
        if (!row) return;
        row.attempts += 1;
        store.put(row);
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const MAX_ATTEMPTS = 10;

export async function drainOutbox(): Promise<{
  ok: boolean;
  drained: number;
  remaining: number;
}> {
  if (!isBrowser()) return { ok: true, drained: 0, remaining: 0 };

  const all = await readAll();
  // Drop entries that have exhausted retry budget — malformed data shouldn't
  // sit forever. 10 attempts = roughly 24 hours with exponential backoff.
  const poisoned = all.filter((e) => e.attempts >= MAX_ATTEMPTS).map((e) => e.id);
  if (poisoned.length > 0) {
    console.warn(
      `[offline-outbox] dropping ${poisoned.length} poisoned entries after ${MAX_ATTEMPTS} failed attempts`,
    );
    await deleteIds(poisoned);
  }

  const pending = all.filter((e) => e.attempts < MAX_ATTEMPTS);
  if (pending.length === 0) {
    return { ok: true, drained: 0, remaining: 0 };
  }

  let response: Response;
  try {
    response = await fetch("/api/offline-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ writes: pending }),
      credentials: "same-origin",
    });
  } catch {
    // Network error → still offline. Bump attempts and stop.
    await bumpAttempts(pending.map((e) => e.id));
    return { ok: false, drained: 0, remaining: pending.length };
  }

  if (!response.ok) {
    await bumpAttempts(pending.map((e) => e.id));
    return { ok: false, drained: 0, remaining: pending.length };
  }

  const body = (await response.json()) as {
    ok: true;
    results: { id: string; ok: boolean }[];
  };

  const successIds = body.results.filter((r) => r.ok).map((r) => r.id);
  const failIds = body.results.filter((r) => !r.ok).map((r) => r.id);

  await deleteIds(successIds);
  await bumpAttempts(failIds);

  return {
    ok: failIds.length === 0,
    drained: successIds.length,
    remaining: failIds.length,
  };
}
