// Export und Import (SPEC 13.3, 13.4, 14.1): Export → Import ergibt denselben Stand,
// ein zweiter Import ändert nichts, beschädigte Dateien ändern nie etwas.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { backupFileName, buildBackup, parseBackup, previewImport, type BackupFile } from '../../src/data/backup';
import { EventStore } from '../../src/data/store';
import { gameEventsOf, type NewAppEvent } from '../../src/engine/events';
import { listGames, x01SetupOf } from '../../src/engine/games';
import { listProfiles } from '../../src/engine/profiles';
import { parseField } from '../../src/engine/types';
import { computeX01, confirmTurn, throwDart, undo } from '../../src/engine/x01';

let n = 0;
const opened: EventStore[] = [];
async function openStore() {
  const s = await EventStore.open(`backup-${++n}`);
  opened.push(s);
  return s;
}
afterEach(() => {
  for (const s of opened.splice(0)) s.close();
});

/** Ein Gerät mit einem Profil und einem angefangenen Spiel inkl. Rückgängig. */
async function deviceWithGame(gameId = 'g1', profileId = 'p1'): Promise<EventStore> {
  const s = await openStore();
  const created: NewAppEvent[] = [
    { type: 'profile.created', payload: { profileId, name: `Spieler ${profileId}`, color: '#f00' } },
    {
      type: 'game.created',
      payload: {
        gameId,
        mode: 'x01',
        settings: { startScore: 501, inMode: 'single', outMode: 'double', legs: { count: 1, kind: 'firstTo' }, sets: null },
        advice: 'expert',
        participants: [
          { slot: 0, kind: 'profile', profileId },
          { slot: 1, kind: 'guest', guestName: 'Gast' },
        ],
        seed: 1,
      },
    },
  ];
  await s.append(created);
  const state = async () => {
    const g = listGames(await s.all()).find((x) => x.created.gameId === gameId)!;
    return computeX01(x01SetupOf(g), gameEventsOf(await s.all(), gameId));
  };
  for (const f of ['T20', 'T20', 'T20']) await s.append([throwDart(await state(), parseField(f))!]);
  await s.append(confirmTurn(await state()));
  await s.append([throwDart(await state(), parseField('S1'))!]);
  await s.append(undo(await state()));
  return s;
}

async function exportText(s: EventStore): Promise<string> {
  return JSON.stringify(await buildBackup(await s.all(), s.deviceId, '0.1.0', new Date('2026-10-25T15:10:00Z')));
}

async function stateOf(s: EventStore, gameId = 'g1') {
  const all = await s.all();
  const g = listGames(all).find((x) => x.created.gameId === gameId)!;
  return computeX01(x01SetupOf(g), gameEventsOf(all, gameId));
}

describe('Export', () => {
  it('enthält alle Ereignisse, auch widerrufene, mit Prüfsumme', async () => {
    const s = await deviceWithGame();
    const b = JSON.parse(await exportText(s)) as BackupFile;
    expect(b.format).toBe('darts-scorer-backup');
    expect(b.formatVersion).toBe(1);
    expect(b.eventCount).toBe(await s.count());
    expect(b.events.some((e) => e.type === 'event.voided')).toBe(true);
    expect(b.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('Dateiname nach SPEC 13.3', () => {
    expect(backupFileName(new Date(2026, 9, 5, 7, 3))).toBe('darts-sicherung-2026-10-05-0703.json');
  });
});

describe('Import', () => {
  it('Export → Import auf leerem Gerät ergibt denselben Spielstand', async () => {
    const a = await deviceWithGame();
    const parsed = await parseBackup(await exportText(a));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const b = await openStore();
    const preview = previewImport(new Set((await b.all()).map((e) => e.id)), parsed.backup);
    expect(preview).toMatchObject({ alreadyPresent: 0, newProfiles: 1, newGames: 1 });
    expect(await b.importEvents(preview.newEvents)).toBe(await a.count());

    expect(await b.all()).toEqual(await a.all()); // IDs, Zeiten, Gerät und Nummern unverändert
    expect((await stateOf(b)).remaining).toEqual((await stateOf(a)).remaining);
    expect(listProfiles(await b.all())).toEqual(listProfiles(await a.all()));
  });

  it('ein zweiter Import ändert nichts', async () => {
    const a = await deviceWithGame();
    const parsed = await parseBackup(await exportText(a));
    if (!parsed.ok) throw new Error(parsed.error);
    const b = await openStore();
    await b.importEvents(parsed.backup.events);
    const before = await b.all();
    const preview = previewImport(new Set(before.map((e) => e.id)), parsed.backup);
    expect(preview.newEvents).toEqual([]);
    expect(preview.alreadyPresent).toBe(parsed.backup.events.length);
    expect(await b.importEvents(parsed.backup.events)).toBe(0);
    expect(await b.all()).toEqual(before);
  });

  it('eigene Sicherung zurückspielen ändert nichts', async () => {
    const a = await deviceWithGame();
    const before = await a.all();
    const parsed = await parseBackup(await exportText(a));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(await a.importEvents(parsed.backup.events)).toBe(0);
    expect(await a.all()).toEqual(before);
  });

  it('Daten zweier Geräte werden vereinigt, nichts überschrieben', async () => {
    const a = await deviceWithGame('g1', 'p1');
    const b = await deviceWithGame('g2', 'p2');
    const bBefore = await b.all();
    const parsed = await parseBackup(await exportText(a));
    if (!parsed.ok) throw new Error(parsed.error);
    await b.importEvents(parsed.backup.events);
    const all = await b.all();
    expect(all).toHaveLength(bBefore.length + (await a.count()));
    for (const e of bBefore) expect(all).toContainEqual(e);
    expect(listGames(all).map((g) => g.created.gameId).sort()).toEqual(['g1', 'g2']);
    expect((await stateOf(b, 'g1')).remaining).toEqual((await stateOf(a, 'g1')).remaining);
  });

  it('importierte Ereignisse vom eigenen Gerät heben die laufende Nummer an', async () => {
    const a = await deviceWithGame();
    const parsed = await parseBackup(await exportText(a));
    if (!parsed.ok) throw new Error(parsed.error);
    const max = Math.max(...parsed.backup.events.map((e) => e.seq));
    // Gleiche Geräte-ID, aber leerer Speicher: so, als wären die Daten verloren gegangen.
    const fresh = await openStore();
    const own = parsed.backup.events.map((e) => ({ ...e, deviceId: fresh.deviceId }));
    await fresh.importEvents(own);
    const [next] = await fresh.append([{ type: 'game.hidden', payload: { gameId: 'g1' } }]);
    expect(next.seq).toBe(max + 1);
  });
});

describe('Beschädigte oder fremde Dateien ändern nichts', () => {
  async function broken(mutate: (b: Record<string, unknown>) => void) {
    const a = await deviceWithGame();
    const b = JSON.parse(await exportText(a));
    mutate(b);
    return parseBackup(JSON.stringify(b));
  }

  it('kein JSON', async () => {
    expect(await parseBackup('hallo')).toMatchObject({ ok: false });
  });

  it('falsches Format', async () => {
    expect(await broken((b) => (b.format = 'andere-app'))).toMatchObject({ ok: false });
  });

  it('neuere Formatversion', async () => {
    const r = await broken((b) => (b.formatVersion = 2));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('neueren App-Version');
  });

  it('veränderter Dart → Prüfsumme stimmt nicht', async () => {
    const r = await broken((b) => {
      const ev = (b.events as { type: string; payload: { field: unknown } }[]).find((e) => e.type === 'dart.thrown')!;
      ev.payload.field = { n: 19, m: 3 }; // aus T20 wird T19
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Prüfsumme');
  });

  it('fehlendes Ereignis → Anzahl stimmt nicht', async () => {
    expect(await broken((b) => (b.events as unknown[]).pop())).toMatchObject({ ok: false });
  });

  it('ungültiges Ereignis mit passender Prüfsumme wird trotzdem abgelehnt', async () => {
    const a = await deviceWithGame();
    const events = await a.all();
    (events[3].payload as { field: unknown }).field = { n: 25, m: 3 }; // Triple-Bull gibt es nicht
    const r = await parseBackup(JSON.stringify(await buildBackup(events, a.deviceId, '0.1.0')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('ungültiges Feld');
  });

  it('doppelte IDs werden abgelehnt', async () => {
    const a = await deviceWithGame();
    const events = await a.all();
    events.push(events[0]);
    const r = await parseBackup(JSON.stringify(await buildBackup(events, a.deviceId, '0.1.0')));
    expect(r.ok).toBe(false);
  });
});

describe('Neue Ereignisarten in der Sicherung', () => {
  it('121-„Überspringen“ und Favoriten lassen sich sichern und wieder einlesen', async () => {
    const a = await deviceWithGame();
    await a.append([
      { type: 'game.decision', payload: { gameId: 'g1', slot: 0, turnIndex: 2, kind: 'skip' } },
      { type: 'game.favorite', payload: { gameId: 'g1', profileId: 'p1', favorite: true } },
    ]);
    const file = JSON.stringify(await buildBackup(await a.all(), a.deviceId, 'test'));
    const parsed = await parseBackup(file);
    expect(parsed.ok).toBe(true);
  });

  it('Turnier-Ereignisse lassen sich sichern und wieder einlesen (SPEC 8.6)', async () => {
    const a = await deviceWithGame();
    await a.append([
      {
        type: 'tournament.created',
        payload: {
          tournamentId: 't1',
          name: 'Turnier',
          mode: 'countup',
          settings: { rounds: 8 },
          start: 'asEntered',
          format: { kind: 'ko', thirdPlace: false },
          entrants: [
            { id: 'e1', kind: 'guest', guestName: 'A' },
            { id: 'e2', kind: 'guest', guestName: 'B' },
          ],
          seed: 1,
        },
      },
      { type: 'tournament.tiebreak', payload: { tournamentId: 't1', matchId: 'ko-r1-m1', gameId: 'g1', winner: 'e1' } },
      { type: 'tournament.ended', payload: { tournamentId: 't1', reason: 'abandoned' } },
    ]);
    const parsed = await parseBackup(JSON.stringify(await buildBackup(await a.all(), a.deviceId, 'test')));
    expect(parsed.ok).toBe(true);
  });
});
