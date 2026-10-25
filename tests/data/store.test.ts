// Ereignisspeicher mit einem nachgebauten Browser-Speicher (fake-indexeddb).
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from '../../src/data/ids';
import { requestPersistence } from '../../src/data/persist';
import { EventStore } from '../../src/data/store';
import { gameEventsOf, type NewAppEvent } from '../../src/engine/events';
import { listGames, unfinishedGame, x01SetupOf } from '../../src/engine/games';
import { parseField } from '../../src/engine/types';
import { computeX01, confirmTurn, throwDart, undo } from '../../src/engine/x01';

let dbCounter = 0;
const opened: EventStore[] = [];
async function openStore(name = `test-${++dbCounter}`) {
  const s = await EventStore.open(name);
  opened.push(s);
  return s;
}
afterEach(() => {
  for (const s of opened.splice(0)) s.close();
});

const gameCreated: NewAppEvent = {
  type: 'game.created',
  payload: {
    gameId: 'g1',
    mode: 'x01',
    settings: { startScore: 501, inMode: 'single', outMode: 'double', legs: { count: 1, kind: 'firstTo' }, sets: null },
    advice: 'expert',
    participants: [
      { slot: 0, kind: 'profile', profileId: 'p1' },
      { slot: 1, kind: 'guest', guestName: 'Gast' },
    ],
    seed: 1,
  },
};

describe('IDs (UUID v7)', () => {
  it('haben das richtige Format und Version 7', () => {
    const id = uuidv7(1_700_000_000_000);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('sind eindeutig und nach Zeit sortierbar', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(1)));
    expect(ids.size).toBe(1000);
    expect(uuidv7(1000) < uuidv7(2000)).toBe(true);
  });
});

describe('EventStore', () => {
  it('vergibt beim ersten Start eine Geräte-ID und behält sie', async () => {
    const a = await openStore('geraet');
    const id = a.deviceId;
    a.close();
    const b = await openStore('geraet');
    expect(b.deviceId).toBe(id);
  });

  it('vergibt ID, Zeit, Gerät und fortlaufende Nummer, auch nach Neustart', async () => {
    const a = await openStore('nummer');
    const first = await a.append([gameCreated, { type: 'game.ended', payload: { gameId: 'g1', reason: 'finished' } }], 1000);
    expect(first.map((e) => e.seq)).toEqual([1, 2]);
    expect(first.every((e) => e.deviceId === a.deviceId && e.ts === 1000 && e.v === 1)).toBe(true);
    expect(new Set(first.map((e) => e.id)).size).toBe(2);
    a.close();

    const b = await openStore('nummer');
    const more = await b.append([{ type: 'game.hidden', payload: { gameId: 'g1' } }]);
    expect(more[0].seq).toBe(3);
    expect(await b.count()).toBe(3);
  });

  it('fügt nur an: frühere Ereignisse bleiben unverändert', async () => {
    const s = await openStore();
    const [created] = await s.append([gameCreated]);
    await s.append([{ type: 'game.ended', payload: { gameId: 'g1', reason: 'abandoned' } }]);
    const all = await s.all();
    expect(all[0]).toEqual(created);
    expect(all).toHaveLength(2);
  });

  it('schützt Geräte-ID und Nummer vor dem Überschreiben', async () => {
    const s = await openStore();
    await expect(s.setMeta('deviceId', 'x')).rejects.toThrow();
    await expect(s.setMeta('seq', 0)).rejects.toThrow();
  });

  it('ein ganzes X01-Spiel übersteht einen Neustart', async () => {
    const s = await openStore('spiel');
    await s.append([gameCreated]);
    const state = async (store: EventStore) => {
      const game = listGames(await store.ofTypes(['game.created', 'game.orderDecided', 'game.ended', 'game.hidden']))[0];
      return computeX01(x01SetupOf(game), gameEventsOf(await store.forGame('g1'), 'g1'));
    };
    const play = async (f: string) => {
      await s.append([throwDart(await state(s), parseField(f))!]);
    };
    await play('T20');
    await play('T20');
    await play('T19');
    await s.append(confirmTurn(await state(s)));
    await play('S5');
    await s.append(undo(await state(s)));
    s.close();

    const again = await openStore('spiel');
    const st = await state(again);
    expect(st.remaining).toEqual({ 0: 324, 1: 501 });
    expect(st.next).toMatchObject({ slot: 1, dartIndex: 1 });
    expect(unfinishedGame(await again.all())?.created.gameId).toBe('g1');
    // der widerrufene Dart (S5) ist noch da, nur als widerrufen markiert
    const stored = await again.forGame('g1');
    expect(stored.filter((e) => e.type === 'dart.thrown')).toHaveLength(4);
    expect(stored.filter((e) => e.type === 'event.voided')).toHaveLength(1);
  });
});

describe('Dauerhafter Speicher', () => {
  it('fragt an und merkt sich das Ergebnis', async () => {
    const s = await openStore();
    const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) };
    expect(await requestPersistence(s, storage as unknown as StorageManager)).toBe('granted');
    expect(storage.persist).toHaveBeenCalledOnce();
    expect(await s.getMeta('persist')).toMatchObject({ status: 'granted' });
  });

  it('fragt nicht erneut, wenn schon gewährt', async () => {
    const s = await openStore();
    const storage = { persisted: vi.fn(async () => true), persist: vi.fn(async () => true) };
    expect(await requestPersistence(s, storage as unknown as StorageManager)).toBe('granted');
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('abgelehnt und nicht unterstützt werden unterschieden', async () => {
    const s = await openStore();
    const denied = { persisted: async () => false, persist: async () => false };
    expect(await requestPersistence(s, denied as unknown as StorageManager)).toBe('denied');
    expect(await requestPersistence(s, undefined)).toBe('unsupported');
  });
});
