// Sicherung aus der Oberfläche heraus: Datei erzeugen und über das Teilen-Menü oder als Download weitergeben.

import { backupFileName, buildBackup } from '../data/backup';
import type { EventStore } from '../data/store';

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

/** Erzeugt die Sicherungsdatei. Muss direkt aus einem Fingertipp heraus aufgerufen werden (Teilen-Menü). */
export async function exportBackup(store: EventStore): Promise<ExportResult> {
  const backup = await buildBackup(await store.all(), store.deviceId, __APP_VERSION__);
  const name = backupFileName();
  const file = new File([JSON.stringify(backup)], name, { type: 'application/json' });

  // Teilen-Menü (iPhone: „In Dateien sichern“, iCloud, Mail). Nur auf Handys, am Rechner lieber Download.
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      await store.setMeta('lastBackupAt', Date.now());
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Teilen klappt nicht: auf Download ausweichen.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  await store.setMeta('lastBackupAt', Date.now());
  return 'downloaded';
}

/** Tage seit der letzten Sicherung; null = noch nie gesichert. */
export function daysSince(ts: number | undefined, now = Date.now()): number | null {
  return ts ? Math.floor((now - ts) / 86_400_000) : null;
}

export const BACKUP_REMINDER_DAYS = 7;
