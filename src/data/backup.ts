// Sicherungsdatei (SPEC 13.3 und 13.4).
// Export: alle Ereignisse (auch widerrufene) plus Prüfsumme. Import: erst prüfen, dann nur Neues anfügen.

import { isValidField } from '../engine/types';
import type { StoredEvent } from './store';

export const BACKUP_FORMAT = 'darts-scorer-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  appVersion: string;
  exportedAt: string;
  deviceId: string;
  eventCount: number;
  sha256: string;
  events: StoredEvent[];
}

export async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function buildBackup(
  events: readonly StoredEvent[],
  deviceId: string,
  appVersion: string,
  now = new Date(),
): Promise<BackupFile> {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_VERSION,
    appVersion,
    exportedAt: now.toISOString(),
    deviceId,
    eventCount: events.length,
    sha256: await sha256Hex(JSON.stringify(events)),
    events: [...events],
  };
}

/** Dateiname nach SPEC 13.3: darts-sicherung-JJJJ-MM-TT-HHMM.json (Ortszeit). */
export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `darts-sicherung-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

// ---------- Prüfen ----------

const KNOWN_TYPES = new Set<string>([
  'profile.created',
  'profile.renamed',
  'profile.archived',
  'profile.restored',
  'game.created',
  'game.orderDecided',
  'game.ended',
  'game.hidden',
  'dart.thrown',
  'turn.confirmed',
  'event.voided',
  'game.decision',
  'bulloff.throw',
]);

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Prüft ein einzelnes Ereignis. Liefert eine Fehlerbeschreibung oder null. */
export function checkEvent(e: unknown): string | null {
  if (!isObj(e)) return 'kein Objekt';
  if (!isStr(e.id)) return 'ID fehlt';
  if (!isStr(e.type) || !KNOWN_TYPES.has(e.type)) return `unbekannte Art „${String(e.type)}“`;
  if (!isNum(e.ts) || !isStr(e.deviceId) || !isNum(e.seq) || !isNum(e.v)) return 'Zeit, Gerät oder Nummer fehlt';
  if (e.v > 1) return 'Ereignis aus einer neueren App-Version';
  const p = e.payload;
  if (!isObj(p)) return 'Inhalt fehlt';
  switch (e.type) {
    case 'profile.created':
      return isStr(p.profileId) && isStr(p.name) && typeof p.color === 'string' ? null : 'Profil unvollständig';
    case 'profile.renamed':
      return isStr(p.profileId) && isStr(p.name) ? null : 'Profil unvollständig';
    case 'profile.archived':
    case 'profile.restored':
      return isStr(p.profileId) ? null : 'Profil unvollständig';
    case 'game.created':
      return isStr(p.gameId) && isStr(p.mode) && isObj(p.settings) && Array.isArray(p.participants)
        ? null
        : 'Spiel unvollständig';
    case 'game.orderDecided':
      return isStr(p.gameId) && Array.isArray(p.order) ? null : 'Reihenfolge unvollständig';
    case 'game.ended':
    case 'game.hidden':
      return isStr(p.gameId) ? null : 'Spiel-ID fehlt';
    case 'dart.thrown': {
      if (!isStr(p.gameId) || ![p.slot, p.leg, p.turnIndex, p.dartIndex].every(isNum)) return 'Dart unvollständig';
      if (p.field !== null && !(isObj(p.field) && isValidField(p.field as never))) return 'ungültiges Feld';
      return null;
    }
    case 'turn.confirmed':
      return isStr(p.gameId) && [p.slot, p.leg, p.turnIndex].every(isNum) ? null : 'Weiter unvollständig';
    case 'event.voided':
      return isStr(p.gameId) && isStr(p.targetId) ? null : 'Widerruf unvollständig';
    case 'bulloff.throw':
      return isStr(p.gameId) && [p.slot, p.attempt, p.xMm, p.yMm, p.distanceMm].every(isNum)
        ? null
        : 'Ausbullen-Wurf unvollständig';
    case 'game.decision':
      return isStr(p.gameId) && isNum(p.slot) && isNum(p.turnIndex) && typeof p.end === 'boolean'
        ? null
        : 'Entscheidung unvollständig';
  }
  return null;
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

/** Liest und prüft eine Sicherungsdatei vollständig, bevor irgendetwas importiert wird. */
export async function parseBackup(text: string): Promise<ParseResult> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei ist keine gültige Sicherung (kein JSON).' };
  }
  if (!isObj(data) || data.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'Die Datei ist keine Sicherung dieser App.' };
  }
  if (!isNum(data.formatVersion) || data.formatVersion > BACKUP_VERSION) {
    return { ok: false, error: 'Die Sicherung stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.' };
  }
  if (!Array.isArray(data.events) || data.eventCount !== data.events.length) {
    return { ok: false, error: 'Die Sicherung ist unvollständig (Anzahl der Ereignisse stimmt nicht).' };
  }
  if ((await sha256Hex(JSON.stringify(data.events))) !== data.sha256) {
    return { ok: false, error: 'Die Prüfsumme stimmt nicht. Die Datei wurde verändert oder ist beschädigt.' };
  }
  const ids = new Set<string>();
  for (let i = 0; i < data.events.length; i++) {
    const err = checkEvent(data.events[i]);
    if (err) return { ok: false, error: `Ereignis ${i + 1} ist ungültig: ${err}.` };
    const id = (data.events[i] as StoredEvent).id;
    if (ids.has(id)) return { ok: false, error: `Ereignis ${i + 1} kommt doppelt vor.` };
    ids.add(id);
  }
  return { ok: true, backup: data as unknown as BackupFile };
}

// ---------- Vorschau ----------

export interface ImportPreview {
  newEvents: StoredEvent[];
  alreadyPresent: number;
  newProfiles: number;
  newGames: number;
}

/** Was würde ein Import ändern? Nur Ereignisse mit unbekannter ID kommen hinzu (SPEC 13.4). */
export function previewImport(existingIds: ReadonlySet<string>, backup: BackupFile): ImportPreview {
  const newEvents = backup.events.filter((e) => !existingIds.has(e.id));
  return {
    newEvents,
    alreadyPresent: backup.events.length - newEvents.length,
    newProfiles: newEvents.filter((e) => e.type === 'profile.created').length,
    newGames: newEvents.filter((e) => e.type === 'game.created').length,
  };
}
