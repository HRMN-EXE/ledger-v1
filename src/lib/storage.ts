// ─── On-device key/value store (native) ─────────────────────────────────────
// Backed by expo-sqlite in WAL mode. Everything is local: the APK never opens
// a socket. The synchronous API is used on purpose so the ported engine
// (localRitualSync / api()) keeps its original non-async shape; the payloads
// are a few tens of KB, so the writes stay in the low-millisecond range.

import * as SQLite from "expo-sqlite";

let handle: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!handle) {
    handle = SQLite.openDatabaseSync("ledger.db");
    try {
      handle.execSync("PRAGMA journal_mode = WAL;");
      handle.execSync("PRAGMA synchronous = NORMAL;");
    } catch {
      // pragmas are best-effort
    }
    handle.execSync(
      "CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);"
    );
  }
  return handle;
}

export function kvGet(key: string): string | null {
  try {
    const row = db().getFirstSync<{ v: string }>("SELECT v FROM kv WHERE k = ?", [key]);
    return row?.v ?? null;
  } catch {
    return null;
  }
}

export function kvSet(key: string, value: string): void {
  try {
    db().runSync(
      "INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
      [key, value]
    );
  } catch {
    // disk full / locked — the in-memory copy keeps the session alive
  }
}

export function kvDelete(key: string): void {
  try {
    db().runSync("DELETE FROM kv WHERE k = ?", [key]);
  } catch {
    // ignore
  }
}

export function kvKeys(): string[] {
  try {
    return db()
      .getAllSync<{ k: string }>("SELECT k FROM kv")
      .map((r) => r.k);
  } catch {
    return [];
  }
}

/** Shown in Settings → Storage. */
export function storageLabel(): string {
  return "SQLite (ledger.db)";
}

export function storageBackend(): "sqlite" | "localstorage" {
  return "sqlite";
}
