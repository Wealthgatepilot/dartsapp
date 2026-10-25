// Profile nach SPEC 6.1: aus Ereignissen berechnet. Archivieren statt löschen.

import type { AppEvent, NewAppEvent } from './events';

export interface Profile {
  profileId: string;
  name: string;
  color: string;
  archived: boolean;
  createdAt: number;
}

export function listProfiles(events: readonly AppEvent[]): Profile[] {
  const byId = new Map<string, Profile>();
  for (const e of events) {
    switch (e.type) {
      case 'profile.created':
        if (!byId.has(e.payload.profileId)) {
          byId.set(e.payload.profileId, { ...e.payload, archived: false, createdAt: e.ts });
        }
        break;
      case 'profile.renamed': {
        const p = byId.get(e.payload.profileId);
        if (p) p.name = e.payload.name;
        break;
      }
      case 'profile.archived':
      case 'profile.restored': {
        const p = byId.get(e.payload.profileId);
        if (p) p.archived = e.type === 'profile.archived';
        break;
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Prüft einen Namen: Pflicht, höchstens 30 Zeichen, eindeutig unter den aktiven Profilen. */
export function checkName(profiles: readonly Profile[], name: string, exceptId?: string): string | null {
  const n = name.trim();
  if (!n) return 'Bitte einen Namen eingeben.';
  if (n.length > 30) return 'Höchstens 30 Zeichen.';
  const taken = profiles.some(
    (p) => !p.archived && p.profileId !== exceptId && p.name.toLocaleLowerCase('de') === n.toLocaleLowerCase('de'),
  );
  return taken ? 'Diesen Namen gibt es schon.' : null;
}

export function createProfile(
  profiles: readonly Profile[],
  profileId: string,
  name: string,
  color: string,
): NewAppEvent | { error: string } {
  const error = checkName(profiles, name);
  if (error) return { error };
  return { type: 'profile.created', payload: { profileId, name: name.trim(), color } };
}

export function renameProfile(
  profiles: readonly Profile[],
  profileId: string,
  name: string,
): NewAppEvent | { error: string } {
  const error = checkName(profiles, name, profileId);
  if (error) return { error };
  return { type: 'profile.renamed', payload: { profileId, name: name.trim() } };
}
