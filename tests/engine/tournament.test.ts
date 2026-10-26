// Turnier nach SPEC 8, Gegenprüfung G66–G76.

import { describe, expect, it } from 'vitest';
import { autoPlayGame, isBotDuel } from '../../src/engine/autoplay';
import { seededRandom } from '../../src/engine/bot';
import { computeCountUp, confirmCountUpTurn, throwCountUpDart } from '../../src/engine/countup';
import type { AppEvent, GameEvent, NewAppEvent } from '../../src/engine/events';
import { computeGame, countUpSetupOf, listGames } from '../../src/engine/games';
import {
  computeTournament,
  formatError,
  listTournaments,
  matchGame,
  planTournament,
  roundRobin,
  standings,
  type Entrant,
  type MatchView,
  type TournamentCreatedPayload,
  type TournamentFormat,
} from '../../src/engine/tournament';
import { isValidField, parseField } from '../../src/engine/types';

const bots = (n: number): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, kind: 'bot', botLevel: 6, botHuman: false }));

const X01 = {
  mode: 'x01' as const,
  settings: { startScore: 501, inMode: 'single' as const, outMode: 'double' as const, legs: { count: 2, kind: 'firstTo' as const }, sets: null },
  advice: 'expert' as const,
};

function tournament(format: TournamentFormat, entrants: Entrant[], extra: Partial<TournamentCreatedPayload> = {}): TournamentCreatedPayload {
  return { tournamentId: 't1', name: 'Test', start: 'asEntered', format, entrants, seed: 42, ...X01, ...extra } as TournamentCreatedPayload;
}

/** Ereignisliste mit IDs und fortlaufender Zeit. */
class Log {
  events: AppEvent[] = [];
  private n = 0;
  add(evs: readonly NewAppEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `x${this.n}`, ts: ++this.n } as AppEvent);
  }
  state() {
    const info = listTournaments(this.events)[0];
    return computeTournament(info, listGames(this.events), this.events);
  }
  /** Alle offenen Partien automatisch ausspielen (alle Teilnehmer sind Computer). */
  playAll(rounds = 50) {
    for (let i = 0; i < rounds; i++) {
      const s = this.state();
      const ready = s.matches.filter((m) => m.status === 'ready');
      if (!ready.length) return s;
      for (const m of ready) this.play(s.created, m);
    }
    return this.state();
  }
  play(t: TournamentCreatedPayload, m: MatchView) {
    const gameId = `g-${m.def.id}-${this.n}`;
    const created = matchGame(t, m, gameId, this.n + 7);
    this.add([{ type: 'game.created', payload: created }]);
    this.add(autoPlayGame(created, seededRandom(this.n)));
  }
}

describe('Auslosung und Spielplan', () => {
  it('G66: K.-o. mit 5 Teilnehmern – Feld 8, 3 Freilose, nie zwei zusammen', () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      const plan = planTournament(tournament({ kind: 'ko', thirdPlace: false }, bots(5), { seed }));
      const r1 = plan.matches.filter((m) => m.round === 1);
      expect(r1).toHaveLength(4);
      expect(plan.koRounds).toBe(3);
      const byes = r1.filter((m) => m.a.kind === 'bye' || m.b.kind === 'bye');
      expect(byes).toHaveLength(3);
      expect(r1.some((m) => m.a.kind === 'bye' && m.b.kind === 'bye')).toBe(false);
      const ids = r1.flatMap((m) => [m.a, m.b]).filter((s) => s.kind === 'entrant').map((s) => (s as { id: string }).id);
      expect(new Set(ids).size).toBe(5);
    }
  });

  it('G66: Freilos-Inhaber stehen ohne Spiel in Runde 2', () => {
    const log = new Log();
    log.add([{ type: 'tournament.created', payload: tournament({ kind: 'ko', thirdPlace: false }, bots(5)) }]);
    const s = log.state();
    const byeMatches = s.matches.filter((m) => m.def.round === 1 && (m.a === 'bye' || m.b === 'bye'));
    expect(byeMatches.every((m) => m.status === 'done' && m.result?.gameId === null)).toBe(true);
    const r2 = s.matches.filter((m) => m.def.round === 2);
    const known = r2.flatMap((m) => [m.a, m.b]).filter((x) => x && x !== 'bye');
    expect(known).toHaveLength(3);
  });

  it('G67: K.-o. mit 2 Teilnehmern – nur das Finale', () => {
    const plan = planTournament(tournament({ kind: 'ko', thirdPlace: true }, bots(2)));
    expect(plan.matches).toHaveLength(1);
    expect(plan.matches[0].final).toBe(true);
  });

  it('G68: Jeder gegen jeden mit 4 – 3 Runden, jede Paarung einmal; zweimal mit getauschtem Anwurf', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const once = roundRobin(ids, false);
    expect(once).toHaveLength(3);
    expect(once.every((r) => r.length === 2)).toBe(true);
    const key = ([x, y]: [string, string]) => [x, y].sort().join('-');
    expect(new Set(once.flat().map(key)).size).toBe(6);
    const twice = roundRobin(ids, true);
    expect(twice).toHaveLength(6);
    const pairs = twice.flat();
    for (const p of once.flat()) expect(pairs.some(([x, y]) => x === p[1] && y === p[0])).toBe(true);
  });

  it('G69: Jeder gegen jeden mit 5 – 5 Runden, je Runde einer spielfrei', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const rounds = roundRobin(ids, false);
    expect(rounds).toHaveLength(5);
    for (const r of rounds) {
      expect(r).toHaveLength(2);
      const playing = new Set(r.flat());
      expect(playing.size).toBe(4);
    }
    expect(new Set(rounds.flat().map(([x, y]) => [x, y].sort().join('-'))).size).toBe(10);
  });

  it('G71: Gruppen 2 × 2 mit 6 – Gruppen à 3, Halbfinale A1–B2 und B1–A2', () => {
    const plan = planTournament(tournament({ kind: 'groups', groups: 2, advance: 2, thirdPlace: false }, bots(6)));
    expect(plan.groups.map((g) => g.length)).toEqual([3, 3]);
    const semis = plan.matches.filter((m) => m.stage === 'ko' && m.round === 1);
    expect(semis.map((m) => [m.a, m.b])).toEqual([
      [
        { kind: 'group', group: 1, place: 1 },
        { kind: 'group', group: 2, place: 2 },
      ],
      [
        { kind: 'group', group: 2, place: 1 },
        { kind: 'group', group: 1, place: 2 },
      ],
    ]);
    expect(plan.matches.filter((m) => m.final)).toHaveLength(1);
  });

  it('Gruppen brauchen genug Teilnehmer', () => {
    expect(formatError({ kind: 'groups', groups: 4, advance: 2, thirdPlace: false }, 11)).toMatch(/mindestens 12/);
    expect(formatError({ kind: 'groups', groups: 4, advance: 2, thirdPlace: false }, 12)).toBeNull();
    expect(formatError({ kind: 'ko', thirdPlace: false }, 1)).toMatch(/zwei/);
  });

  it('gleiche Zufallszahl → gleiche Auslosung', () => {
    const a = planTournament(tournament({ kind: 'ko', thirdPlace: false }, bots(7), { seed: 5 }));
    const b = planTournament(tournament({ kind: 'ko', thirdPlace: false }, bots(7), { seed: 5 }));
    expect(a).toEqual(b);
  });
});

describe('Tabelle', () => {
  const view = (a: string, b: string, winner: string, legsA: number, legsB: number): MatchView => ({
    def: { id: `${a}${b}`, stage: 'league', round: 1, a: { kind: 'entrant', id: a }, b: { kind: 'entrant', id: b } },
    a,
    b,
    status: 'done',
    result: { winner, loser: winner === a ? b : a, legsA, legsB, gameId: 'g' },
    gameId: 'g',
    stats: { a: { num: 0, den: 0 }, b: { num: 0, den: 0 } },
  });

  it('Sieg 2 Punkte, Reihenfolge nach Punkten und Leg-Differenz', () => {
    const t = standings(['a', 'b', 'c'], [view('a', 'b', 'a', 2, 0), view('b', 'c', 'b', 2, 1), view('a', 'c', 'c', 1, 2)], 1);
    // a: 2 P, Legs 3:2; b: 2 P, Legs 2:3; c: 2 P, Legs 3:3 → Differenz a +1, c 0, b −1
    expect(t.map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(t[0]).toMatchObject({ played: 2, won: 1, lost: 1, points: 2, legsFor: 3, legsAgainst: 2 });
  });

  it('G70: gleiche Punkte, Leg-Differenz und Legs → direkter Vergleich', () => {
    // a und b: je 4 Punkte, Legs 5:4; a hat b geschlagen
    const t = standings(
      ['a', 'b', 'c', 'd'],
      [view('a', 'b', 'a', 2, 1), view('a', 'c', 'a', 2, 1), view('b', 'c', 'b', 2, 1), view('c', 'd', 'c', 2, 1), view('d', 'a', 'd', 2, 1), view('d', 'b', 'b', 1, 2)],
      1,
    );
    const ra = t.find((r) => r.id === 'a')!;
    const rb = t.find((r) => r.id === 'b')!;
    expect([ra.points, ra.legsFor, ra.legsAgainst]).toEqual([4, 5, 4]);
    expect([rb.points, rb.legsFor, rb.legsAgainst]).toEqual([4, 5, 4]);
    expect(t.indexOf(ra)).toBeLessThan(t.indexOf(rb));
  });

  it('Regel 5 und 6: Kennzahl, danach Los (immer gleich)', () => {
    const withStat = (a: string, b: string, winner: string, statA: number, statB: number): MatchView => ({
      ...view(a, b, winner, 2, 1),
      stats: { a: { num: statA, den: 1 }, b: { num: statB, den: 1 } },
    });
    // Dreieck: alle 2 Punkte, Legs 3:3, direkter Vergleich gleich → höhere Kennzahl vorn
    const t = standings(['x', 'y', 'z'], [withStat('x', 'y', 'y', 60, 50), withStat('y', 'z', 'z', 50, 40), withStat('z', 'x', 'x', 40, 60)], 1);
    expect(t.map((r) => r.id)).toEqual(['x', 'y', 'z']);
    const lot = () => standings(['x', 'y', 'z'], [view('x', 'y', 'y', 2, 1), view('y', 'z', 'z', 2, 1), view('z', 'x', 'x', 2, 1)], 9);
    expect(lot()).toEqual(lot());
  });
});

describe('Partien und Ergebnisse', () => {
  it('ganzes K.-o.-Turnier mit 6 Computern bis zum Sieger', () => {
    const log = new Log();
    log.add([{ type: 'tournament.created', payload: tournament({ kind: 'ko', thirdPlace: true }, bots(6)) }]);
    const s = log.playAll();
    expect(s.complete).toBe(true);
    expect(s.podium).toHaveLength(4);
    expect(new Set(s.podium).size).toBe(4);
  });

  it('G74: Spiel um Platz 3 mit den beiden Halbfinal-Verlierern', () => {
    const log = new Log();
    log.add([{ type: 'tournament.created', payload: tournament({ kind: 'ko', thirdPlace: true }, bots(4)) }]);
    const s = log.playAll();
    const semis = s.matches.filter((m) => m.def.round === 1);
    const p3 = s.matches.find((m) => m.def.id === 'ko-p3')!;
    expect(new Set([p3.a, p3.b])).toEqual(new Set(semis.map((m) => m.result!.loser)));
  });

  it('ganzes Jeder-gegen-jeden mit 4 und Gruppen + K.-o. mit 6', () => {
    const league = new Log();
    league.add([{ type: 'tournament.created', payload: tournament({ kind: 'league', twice: false }, bots(4)) }]);
    const a = league.playAll();
    expect(a.complete).toBe(true);
    expect(a.tables[0].reduce((n, r) => n + r.played, 0)).toBe(12);
    expect(a.tables[0].reduce((n, r) => n + r.points, 0)).toBe(12);
    expect(a.podium[0]).toBe(a.tables[0][0].id);

    const groups = new Log();
    groups.add([{ type: 'tournament.created', payload: tournament({ kind: 'groups', groups: 2, advance: 2, thirdPlace: false }, bots(6)) }]);
    const g = groups.playAll();
    expect(g.complete).toBe(true);
    const semis = g.matches.filter((m) => m.def.stage === 'ko' && m.def.round === 1);
    expect(semis[0].a).toBe(g.tables[0][0].id);
    expect(semis[0].b).toBe(g.tables[1][1].id);
  });

  it('G72: abgebrochenes Spiel lässt die Partie offen, das nächste beendete zählt', () => {
    const log = new Log();
    log.add([{ type: 'tournament.created', payload: tournament({ kind: 'ko', thirdPlace: false }, bots(2)) }]);
    let s = log.state();
    const m = s.matches[0];
    log.add([{ type: 'game.created', payload: matchGame(s.created, m, 'first', 1) }]);
    expect(log.state().matches[0].status).toBe('playing');
    log.add([{ type: 'game.ended', payload: { gameId: 'first', reason: 'abandoned' } }]);
    s = log.state();
    expect(s.matches[0].status).toBe('ready');
    log.play(s.created, s.matches[0]);
    s = log.state();
    expect(s.matches[0].status).toBe('done');
    expect(s.matches[0].result!.gameId).not.toBe('first');
  });

  it('G73: Gleichstand bei Count-Up braucht Ausbullen, tournament.tiebreak entscheidet', () => {
    const log = new Log();
    const t = tournament({ kind: 'ko', thirdPlace: false }, bots(2), { mode: 'countup', settings: { rounds: 1 } } as Partial<TournamentCreatedPayload>);
    delete (t as { advice?: unknown }).advice;
    log.add([{ type: 'tournament.created', payload: t }]);
    const view = log.state().matches[0];
    const created = matchGame(t, view, 'tie', 1);
    log.add([{ type: 'game.created', payload: created }, { type: 'game.orderDecided', payload: { gameId: 'tie', order: [0, 1], method: 'asEntered' } }]);
    // Beide werfen T20 T20 T20
    for (let p = 0; p < 2; p++) {
      for (let i = 0; i < 3; i++) {
        const g = listGames(log.events).find((x) => x.created.gameId === 'tie')!;
        const st = computeCountUp(countUpSetupOf(g), log.events.filter((e) => 'gameId' in e.payload) as GameEvent[]);
        log.add([throwCountUpDart(st, parseField('T20')!)!]);
      }
      const g = listGames(log.events).find((x) => x.created.gameId === 'tie')!;
      const st = computeCountUp(countUpSetupOf(g), log.events.filter((e) => 'gameId' in e.payload) as GameEvent[]);
      log.add(confirmCountUpTurn(st));
    }
    log.add([{ type: 'game.ended', payload: { gameId: 'tie', reason: 'finished' } }]);
    let s = log.state();
    expect(s.matches[0].status).toBe('tiebreak');
    log.add([{ type: 'tournament.tiebreak', payload: { tournamentId: 't1', matchId: view.def.id, gameId: 'tie', winner: view.b as string } }]);
    s = log.state();
    expect(s.matches[0].status).toBe('done');
    expect(s.matches[0].result!.winner).toBe(view.b);
    expect(s.podium[0]).toBe(view.b);
  });

  it('G75: Computer gegen Computer ergibt ein beendetes Spiel mit genau einem Sieger und nur gültigen Darts', () => {
    const log = new Log();
    const t = tournament({ kind: 'ko', thirdPlace: false }, bots(2), { start: 'bull' });
    log.add([{ type: 'tournament.created', payload: t }]);
    const view = log.state().matches[0];
    const created = matchGame(t, view, 'auto', 3);
    expect(isBotDuel(created)).toBe(true);
    log.add([{ type: 'game.created', payload: created }]);
    log.add(autoPlayGame(created, seededRandom(11)));
    const g = listGames(log.events).find((x) => x.created.gameId === 'auto')!;
    expect(g.ended).toBe('finished');
    expect(g.orderDecided).toBe(true);
    const st = computeGame(g, log.events).state;
    expect(st.finished).toBe(true);
    expect(st.matchWinners).toHaveLength(1);
    expect(st.ignored).toEqual([]);
    for (const e of log.events) if (e.type === 'dart.thrown') expect(e.payload.field === null || isValidField(e.payload.field)).toBe(true);
    expect(log.events.some((e) => e.type === 'bulloff.throw')).toBe(true);
  });

  it('G75: automatisch ausgespielt in allen Turnier-Modi', () => {
    const specs = [
      { mode: 'cricket', settings: { targets: [20, 19, 18, 17, 16, 15, 25], closeAt: 3, variant: 'standard', legs: { count: 1, kind: 'firstTo' }, sets: null } },
      { mode: 'shanghai', settings: { startNumber: 1, rounds: 7, endOnShanghai: false } },
      { mode: 'countup', settings: { rounds: 4 } },
      { mode: 'atc', settings: { withBull: false, ring: 'any', jumps: false } },
      { mode: 'halveit', settings: { targets: [15, 16, 'D', 17], startPoints: 0 } },
    ];
    specs.forEach((spec, i) => {
      const t = { tournamentId: 't1', name: 'x', start: 'coin', format: { kind: 'ko', thirdPlace: false }, entrants: bots(2), seed: i, ...spec } as TournamentCreatedPayload;
      const log = new Log();
      log.add([{ type: 'tournament.created', payload: t }]);
      const s = log.playAll();
      expect(s.matches[0].status === 'done' || s.matches[0].status === 'tiebreak').toBe(true);
    });
  });

  it('G76: Finale mit eigener Leg-Zahl', () => {
    const t = tournament({ kind: 'ko', thirdPlace: false }, bots(4), { finalLegs: { count: 3, kind: 'firstTo' } });
    const log = new Log();
    log.add([{ type: 'tournament.created', payload: t }]);
    const s = log.state();
    const semi = matchGame(t, s.matches[0], 'a', 1);
    expect(semi.mode === 'x01' && semi.settings.legs.count).toBe(2);
    const final = { ...s.matches.find((m) => m.def.final)!, a: 'e1', b: 'e2' } as MatchView;
    const f = matchGame(t, final, 'b', 1);
    expect(f.mode === 'x01' && f.settings.legs.count).toBe(3);
    expect(f.tournament).toEqual({ tournamentId: 't1', matchId: final.def.id });
  });
});
