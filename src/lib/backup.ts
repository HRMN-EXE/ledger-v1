// ─── Backup / restore — the only way data leaves the device ─────────────────
// Plain JSON, written to a file the user chooses. No cloud, no account.

import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { DB_KEY, loadDB, replaceDB, type LocalDB } from "@/lib/localdb";
import { kvGet } from "@/lib/storage";

export interface BackupFile {
  app: "ledger";
  version: 1;
  exportedAt: string;
  db: LocalDB;
}

export function buildBackup(): BackupFile {
  return {
    app: "ledger",
    version: 1,
    exportedAt: new Date().toISOString(),
    db: loadDB(),
  };
}

export function backupToJSON(): string {
  return JSON.stringify(buildBackup(), null, 2);
}

/** Write the backup into the app's cache dir and open the share sheet. */
export async function shareBackup(): Promise<boolean> {
  const json = backupToJSON();
  if (Platform.OS === "web") {
    try {
      await Clipboard.setStringAsync(json);
      return true;
    } catch {
      return false;
    }
  }
  try {
    const dir = new Directory(Paths.cache, "backup");
    if (!dir.exists) dir.create({ intermediates: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const file = new File(dir, `ledger-backup-${stamp}.json`);
    if (file.exists) file.delete();
    file.create();
    file.write(json);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Ledger backup" });
    }
    return true;
  } catch {
    return false;
  }
}

export async function copyBackupToClipboard(): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(backupToJSON());
    return true;
  } catch {
    return false;
  }
}

/** Pick a backup file and apply it. Returns null when cancelled. */
export async function importBackupFromFile(): Promise<{ ok: boolean; message: string }> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/plain", "*/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return { ok: false, message: "cancelled" };
    const asset = picked.assets[0];
    let text: string;
    if (Platform.OS === "web") {
      const res = await fetch(asset.uri);
      text = await res.text();
    } else {
      text = new File(asset.uri).textSync();
    }
    return applyBackupText(text);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not read that file" };
  }
}

export function applyBackupText(text: string): { ok: boolean; message: string } {
  try {
    const parsed = JSON.parse(text) as Partial<BackupFile>;
    const db = parsed?.db as LocalDB | undefined;
    if (!db || typeof db !== "object" || !Array.isArray(db.tasks)) {
      return { ok: false, message: "That file doesn't look like a Ledger backup" };
    }
    replaceDB(db);
    return { ok: true, message: `Restored ${db.tasks.length} task(s), ${db.rituals?.length ?? 0} ritual(s)` };
  } catch {
    return { ok: false, message: "That file isn't valid JSON" };
  }
}

/** How big is the on-device document? */
export function dbSize(): number {
  const raw = kvGet(DB_KEY);
  return raw ? raw.length : 0;
}

export function dbSizeLabel(): string {
  const bytes = dbSize();
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
