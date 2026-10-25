// Ereignisspeicher in IndexedDB (SPEC 3 und 13.2).
// Grundregel: Ereignisse werden nur angefügt, nie verändert und nie gelöscht.

import Dexie, { type Table } from 'dexie';
import type { AppEvent, NewAppEvent } from '../engine/events';
import { uuidv7 } from './ids';

/** Ein gespeichertes Ereignis: wie AppEvent, plus Gerät, laufende Nummer und Formatversion. */
export type StoredEvent = AppEvent & { deviceId: string; seq: number; v: number };

export const EVENT_VERSION = 1;

interface MetaRow {
  key: string;
  value: unknown;
}

class DartsDB extends Dexie {
  events!: Table<StoredEvent, string>;
  meta!: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      events: 'id, type, ts, payload.gameId, payload.profileId',
      meta: 'key',
    });
  }
}

/** Reihenfolge laut SPEC 3.5: Zeitstempel, dann Gerät, dann laufende Nummer. */
export function compareEvents(a: StoredEvent, b: StoredEvent): number {
  return a.ts - b.ts || (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0) || a.seq - b.seq;
}

export class EventStore {
  private constructor(
    private readonly db: DartsDB,
    readonly deviceId: string,
  ) {}

  static async open(name = 'darts'): Promise<EventStore> {
    const db = new DartsDB(name);
    await db.open();
    const deviceId = await db.transaction('rw', db.meta, async () => {
      const row = await db.meta.get('deviceId');
      if (row) return row.value as string;
      const id = crypto.randomUUID();
      await db.meta.add({ key: 'deviceId', value: id });
      return id;
    });
    return new EventStore(db, deviceId);
  }

  close(): void {
    this.db.close();
  }

  /**
   * Fügt neue Ereignisse an. Alle oder keins (eine Transaktion).
   * Vergibt ID, Zeitstempel, Geräte-ID und laufende Nummer.
   */
  async append(events: readonly NewAppEvent[], now: number = Date.now()): Promise<StoredEvent[]> {
    if (!events.length) return [];
    return this.db.transaction('rw', this.db.events, this.db.meta, async () => {
      const row = await this.db.meta.get('seq');
      let seq = (row?.value as number | undefined) ?? 0;
      const stored = events.map(
        (e) =>
          ({
            ...e,
            id: uuidv7(now),
            ts: now,
            deviceId: this.deviceId,
            seq: ++seq,
            v: EVENT_VERSION,
          }) as StoredEvent,
      );
      // bulkAdd (nicht put): Eine schon vorhandene ID würde einen Fehler auslösen statt zu überschreiben.
      await this.db.events.bulkAdd(stored);
      await this.db.meta.put({ key: 'seq', value: seq });
      return stored;
    });
  }

  /** Alle Ereignisse in Speicherreihenfolge. */
  async all(): Promise<StoredEvent[]> {
    return (await this.db.events.toArray()).sort(compareEvents);
  }

  /** Alle Ereignisse eines Spiels (Darts, Weiter, Widerrufe, Spielverwaltung). */
  async forGame(gameId: string): Promise<StoredEvent[]> {
    return (await this.db.events.where('payload.gameId').equals(gameId).toArray()).sort(compareEvents);
  }

  /** Ereignisse bestimmter Arten, z. B. alle Profil- oder Spielverwaltungs-Ereignisse. */
  async ofTypes(types: readonly AppEvent['type'][]): Promise<StoredEvent[]> {
    return (await this.db.events.where('type').anyOf(types as string[]).toArray()).sort(compareEvents);
  }

  async count(): Promise<number> {
    return this.db.events.count();
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.meta.get(key))?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    if (key === 'deviceId' || key === 'seq') throw new Error(`${key} ist geschützt`);
    await this.db.meta.put({ key, value });
  }
}
