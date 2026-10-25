import { describe, expect, it } from 'vitest';
import type { AppEvent, NewAppEvent } from '../../src/engine/events';
import { listGames, unfinishedGame, x01SetupOf } from '../../src/engine/games';
import { createProfile, listProfiles, renameProfile } from '../../src/engine/profiles';

let n = 0;
const stamp = (e: NewAppEvent): AppEvent => ({ ...e, id: `id${++n}`, ts: ++n }) as AppEvent;

describe('Profile (SPEC 6.1)', () => {
  it('anlegen, umbenennen, archivieren, wiederherstellen', () => {
    const events: AppEvent[] = [];
    const add = (r: NewAppEvent | { error: string }) => {
      if ('error' in r) throw new Error(r.error);
      events.push(stamp(r));
    };
    add(createProfile(listProfiles(events), 'p1', 'Gian', '#f00'));
    add(createProfile(listProfiles(events), 'p2', 'Jörn', '#0f0'));
    add(renameProfile(listProfiles(events), 'p1', 'Gianluca'));
    events.push(stamp({ type: 'profile.archived', payload: { profileId: 'p2' } }));

    const profiles = listProfiles(events);
    expect(profiles.map((p) => [p.profileId, p.name, p.archived])).toEqual([
      ['p1', 'Gianluca', false],
      ['p2', 'Jörn', true],
    ]);

    events.push(stamp({ type: 'profile.restored', payload: { profileId: 'p2' } }));
    expect(listProfiles(events).find((p) => p.profileId === 'p2')!.archived).toBe(false);
  });

  it('Name ist Pflicht und unter aktiven Profilen eindeutig (Groß/klein egal)', () => {
    const events = [stamp({ type: 'profile.created', payload: { profileId: 'p1', name: 'Gian', color: '#f00' } })];
    expect(createProfile(listProfiles(events), 'p2', '  ', '#0f0')).toHaveProperty('error');
    expect(createProfile(listProfiles(events), 'p2', 'gian', '#0f0')).toHaveProperty('error');
    expect(createProfile(listProfiles(events), 'p2', 'x'.repeat(31), '#0f0')).toHaveProperty('error');
    // Umbenennen auf den eigenen Namen ist erlaubt
    expect(renameProfile(listProfiles(events), 'p1', 'GIAN')).not.toHaveProperty('error');
  });

  it('der Name eines archivierten Profils darf neu vergeben werden', () => {
    const events = [
      stamp({ type: 'profile.created', payload: { profileId: 'p1', name: 'Gian', color: '#f00' } }),
      stamp({ type: 'profile.archived', payload: { profileId: 'p1' } }),
    ];
    expect(createProfile(listProfiles(events), 'p2', 'Gian', '#0f0')).not.toHaveProperty('error');
  });
});

describe('Spiele', () => {
  const created = (gameId: string): NewAppEvent => ({
    type: 'game.created',
    payload: {
      gameId,
      mode: 'x01',
      settings: { startScore: 501, inMode: 'single', outMode: 'double', legs: { count: 1, kind: 'firstTo' }, sets: null },
      advice: 'expert',
      participants: [
        { slot: 0, kind: 'profile', profileId: 'p1' },
        { slot: 1, kind: 'guest', guestName: 'Oma', startScore: 301 },
      ],
      seed: 1,
    },
  });

  it('erkennt das zuletzt begonnene, nicht beendete Spiel', () => {
    const events = [
      stamp(created('g1')),
      stamp({ type: 'game.ended', payload: { gameId: 'g1', reason: 'finished' } }),
      stamp(created('g2')),
    ];
    expect(unfinishedGame(events)?.created.gameId).toBe('g2');
    events.push(stamp({ type: 'game.ended', payload: { gameId: 'g2', reason: 'abandoned' } }));
    expect(unfinishedGame(events)).toBeNull();
    expect(listGames(events).map((g) => [g.created.gameId, g.ended])).toEqual([
      ['g2', 'abandoned'],
      ['g1', 'finished'],
    ]);
  });

  it('übernimmt die festgelegte Reihenfolge und das Handicap', () => {
    const events = [
      stamp(created('g1')),
      stamp({ type: 'game.orderDecided', payload: { gameId: 'g1', order: [1, 0], method: 'coin' } }),
    ];
    const setup = x01SetupOf(listGames(events)[0]);
    expect(setup.order).toEqual([1, 0]);
    expect(setup.startScores).toEqual({ 1: 301 });
  });
});
