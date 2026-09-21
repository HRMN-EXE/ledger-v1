// ─── On-device key/value store (web preview only) ───────────────────────────
// The real app runs on SQLite (see `storage.ts`). This file exists so
// `expo start --web` can preview the exact same UI in a browser during
// development — it is never part of the APK.

function safe<T>(fn: () => T, fallback: T): T {
  try {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    return fn();
  } catch {
    return fallback;
  }
}

export function kvGet(key: string): string | null {
  return safe(() => window.localStorage.getItem(key), null);
}

export function kvSet(key: string, value: string): void {
  safe(() => window.localStorage.setItem(key, value), undefined);
}

export function kvDelete(key: string): void {
  safe(() => window.localStorage.removeItem(key), undefined);
}

export function kvKeys(): string[] {
  return safe(() => {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) out.push(k);
    }
    return out;
  }, []);
}

export function storageLabel(): string {
  return "Browser localStorage (preview)";
}

export function storageBackend(): "sqlite" | "localstorage" {
  return "localstorage";
}
