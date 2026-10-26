// 121 in der neuen Form (zufällige Finishes 70–170, Wunsch Gianluca), Gegenprüfung G60–G65.

import { describe, expect, it } from 'vitest';
import { suggestCheckout } from '../../src/engine/checkout';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import {
  DEFAULT_FINISH,
  computeFinish,
  confirmFinishTurn,
  finishPool,
  finishSequence,
  skipFinish,
  throwFinishDart,
  undoFinish,
  type FinishSettings,
  type FinishSetup,
  type FinishState,
} from '../../src/engine/finish';
import { formatCheckout } from '../../src/engine/checkout';
import { parseField } from '../../src/engine/types';

const A = 0;
const B = 1;

class Finish {
  events: GameEvent[] = [];
  private n = 0;
  readonly setup: FinishSetup;
  constructor(settings: FinishSettings, players: number, seed: number) {
    this.setup = { gameId: 'f1', settings, order: [...Array(players).keys()], seed };
  }
  /** Seed so wählen, dass Spieler A als erste Zahl `first` bekommt. */
  static create(patch: Partial<FinishSettings> = {}, players = 1, first?: number) {
    const settings = { ...DEFAULT_FINISH, ...patch };
    for (let seed = 1; seed < 100_000; seed++) {
      const g = new Finish(settings, players, seed);
      if (first === undefined || finishSequence(g.setup, A)[0] === first) return g;
    }
    throw new Error('kein Seed gefunden');
  }
  get state(): FinishState {
    return computeFinish(this.setup, this.events);
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  throw(...fs: string[]) {
    for (const f of fs) {
      const ev = throwFinishDart(this.state, parseField(f));
      if (!ev) throw new Error(`Dart ${f} nicht möglich`);
      this.add([ev]);
    }
    return this;
  }
  turn(...fs: string[]) {
    return this.throw(...fs).add(confirmFinishTurn(this.state));
  }
}

describe('121 mit zufälligen Finishes', () => {
  it('G60: nur checkbare Zahlen 70–170, wiederholbar, gemeinsam oder eigen', () => {
    const pool = finishPool('double');
    for (const n of [169, 168, 166, 165, 163, 162, 159]) expect(pool).not.toContain(n);
    expect(pool).toContain(170);
    expect(pool).toContain(70);
    const g = Finish.create({ rounds: 50 }, 2);
    const seqA = finishSequence(g.setup, A);
    for (const n of seqA) {
      expect(n).toBeGreaterThanOrEqual(70);
      expect(n).toBeLessThanOrEqual(170);
      expect(suggestCheckout(n, 3, 'double', 'expert')).not.toBeNull();
    }
    expect(finishSequence(g.setup, A)).toEqual(seqA);
    expect(finishSequence(g.setup, B)).toEqual(seqA); // „dieselben Zahlen“
    const own = Finish.create({ rounds: 50, sequence: 'own' }, 2);
    expect(finishSequence(own.setup, B)).not.toEqual(finishSequence(own.setup, A));
  });

  it('G61: Zahl unter 100 → nach 6 Darts dieselbe Zahl, 2. Versuch', () => {
    const g = Finish.create({}, 1, 81).turn('S1', 'S1', 'S1');
    expect(g.state.players[A].rest).toBe(78);
    g.turn('S1', 'S1', 'S1');
    const p = g.state.players[A];
    expect(p.rest).toBe(81);
    expect(p.round).toBe(0);
    expect(p.results[0].attempts).toBe(2);
    expect(p.results[0].darts).toBe(6);
  });

  it('G62: Zahl ab 100 → 9 Darts je Versuch', () => {
    const big = finishPool('double').find((n) => n >= 100)!;
    const g = Finish.create({}, 1, big);
    for (let i = 0; i < 2; i++) g.turn('S1', 'S1', 'S1');
    expect(g.state.players[A].results[0].attempts).toBe(1);
    g.turn('S1', 'S1', 'S1');
    expect(g.state.players[A].results[0].attempts).toBe(2);
    expect(g.state.players[A].rest).toBe(big);
  });

  it('G63: Checkout → Runde geschafft, nächste Zahl', () => {
    const g = Finish.create({ rounds: 3 }, 1, 81);
    expect(formatCheckout(suggestCheckout(81, 3, 'double', 'expert'))).toBe('T19 D12');
    g.turn('T19', 'D12');
    const p = g.state.players[A];
    expect(p.results[0]).toMatchObject({ target: 81, success: true, darts: 2, attempts: 1 });
    expect(p.round).toBe(1);
    expect(p.rest).toBe(finishSequence(g.setup, A)[1]);
  });

  it('Bust: Rest zurück, Aufnahme vorbei, Versuch läuft weiter', () => {
    const g = Finish.create({}, 1, 81).throw('T20', 'S20');
    const t = g.state.currentTurn!;
    expect(t.bust).toBe(true);
    g.add(confirmFinishTurn(g.state));
    expect(g.state.players[A].rest).toBe(81);
    expect(g.state.players[A].turnsUsed).toBe(1);
  });

  it('G64: letzte Zahl überspringen → fertig; Rückgängig hebt es auf', () => {
    const g = Finish.create({ rounds: 1 }, 1, 81).turn('S1', 'S1', 'S1');
    expect(g.state.canSkip).toBe(true);
    g.add(skipFinish(g.state));
    expect(g.state.finished).toBe(true);
    expect(g.state.players[A].results[0]).toMatchObject({ success: false, skipped: true, darts: 3 });
    g.add(undoFinish(g.state, g.events));
    expect(g.state.finished).toBe(false);
    expect(g.state.players[A].rest).toBe(78);
    // danach nimmt Rückgängig wieder Darts zurück
    g.add(undoFinish(g.state, g.events));
    expect(g.state.currentTurn!.darts).toHaveLength(3);
  });

  it('nach einem Dart in der Aufnahme kein Überspringen mehr', () => {
    const g = Finish.create({}, 1, 81).throw('S1');
    expect(g.state.canSkip).toBe(false);
    expect(skipFinish(g.state)).toEqual([]);
  });

  it('G65: mehr geschaffte Zahlen gewinnen vor weniger Darts', () => {
    const g = Finish.create({ rounds: 1 }, 2, 81);
    g.turn('T19', 'S4', 'D10'); // A: 57 + 4 + 20 = 81
    g.add(skipFinish(g.state)); // B überspringt, 0 Darts
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinners).toEqual([A]);
  });
});
