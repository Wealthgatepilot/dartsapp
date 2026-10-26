// Killer nach SPEC 7.6, Gegenprüfung G56–G59.

import { describe, expect, it } from 'vitest';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import {
  DEFAULT_KILLER,
  computeKiller,
  confirmKillerTurn,
  randomKillerNumbers,
  throwKillerDart,
  undoKiller,
  validateKiller,
  validateKillerNumbers,
  type KillerSettings,
  type KillerState,
} from '../../src/engine/killer';
import { parseField } from '../../src/engine/types';

const A = 0;
const B = 1;
const C = 2;

class Killer {
  events: GameEvent[] = [];
  private n = 0;
  constructor(
    readonly settings: KillerSettings,
    readonly players: number,
  ) {}
  /** A hat die 20, B die 5, C die 1. */
  static create(patch: Partial<KillerSettings> = {}, players = 2) {
    const numbers = Object.fromEntries([20, 5, 1].slice(0, players).map((n, i) => [i, n]));
    return new Killer({ ...DEFAULT_KILLER, numbers, ...patch }, players);
  }
  get state(): KillerState {
    return computeKiller({ gameId: 'k1', settings: this.settings, order: [...Array(this.players).keys()] }, this.events);
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  throw(...fs: string[]) {
    for (const f of fs) {
      const ev = throwKillerDart(this.state, parseField(f));
      if (!ev) throw new Error(`Dart ${f} nicht möglich`);
      this.add([ev]);
    }
    return this;
  }
  turn(...fs: string[]) {
    return this.throw(...fs).add(confirmKillerTurn(this.state));
  }
  get ls() {
    return this.state.legs[0].state;
  }
}

describe('Killer', () => {
  it('Einstellungen und Zahlen prüfen', () => {
    expect(validateKiller(DEFAULT_KILLER, 1)).toHaveLength(1);
    expect(validateKiller(DEFAULT_KILLER, 2)).toEqual([]);
    expect(validateKillerNumbers([20, 5])).toEqual([]);
    expect(validateKillerNumbers([20, 20])).toHaveLength(1);
    expect(validateKillerNumbers([0, 5])).toHaveLength(1);
    const r = randomKillerNumbers(20, Math.random);
    expect(new Set(r).size).toBe(20);
  });

  it('G56: vor dem Killer zählen fremde Zahlen nicht, nur Doubles der eigenen Zahl', () => {
    const g = Killer.create().throw('D5', 'S20');
    expect(g.ls.lives[B]).toBe(3);
    expect(g.ls.killer[A]).toBe(false);
    g.throw('D20');
    expect(g.ls.killer[A]).toBe(true);
    expect(g.state.targetsFor(A)).toEqual([20, 5]);
    expect(g.state.targetsFor(B)).toEqual([5]);
  });

  it('G57: Killer nimmt 1 Leben je Treffer, auch mit einem Triple im ganzen Segment', () => {
    const d = Killer.create().throw('D20', 'D5');
    expect(d.ls.lives[B]).toBe(2);
    const seg = Killer.create({ zone: 'segment' }).throw('S20', 'T5');
    expect(seg.ls.lives[B]).toBe(2);
  });

  it('mehrere Treffer bis zum Killer', () => {
    const g = Killer.create({ hitsToKiller: 3 }).throw('D20', 'D20');
    expect(g.ls.progress[A]).toBe(2);
    expect(g.ls.killer[A]).toBe(false);
    g.throw('D20');
    expect(g.ls.killer[A]).toBe(true);
  });

  it('G58: letztes Leben weg → ausgeschieden, der Letzte gewinnt sofort', () => {
    const g = Killer.create({ lives: 1 }).throw('D20', 'D5');
    expect(g.ls.out).toEqual([B]);
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinners).toEqual([A]);
    g.add(undoKiller(g.state));
    expect(g.state.finished).toBe(false);
    expect(g.ls.lives[B]).toBe(1);
  });

  it('mit 3 Spielern wird ein Ausgeschiedener übersprungen', () => {
    const g = Killer.create({ lives: 1 }, 3).turn('D20', 'D5');
    expect(g.ls.out).toEqual([B]);
    expect(g.state.next?.slot).toBe(C);
  });

  it('G59: Eigentreffer als Killer kostet ein Leben – oder zählt nicht', () => {
    expect(Killer.create().throw('D20', 'D20').ls.lives[A]).toBe(2);
    expect(Killer.create({ selfHit: 'nothing' }).throw('D20', 'D20').ls.lives[A]).toBe(3);
  });

  it('wer sich selbst das letzte Leben nimmt, scheidet aus; bleibt einer übrig, gewinnt er', () => {
    const g = Killer.create({ lives: 1 }).throw('D20', 'D20');
    expect(g.ls.out).toEqual([A]);
    expect(g.state.matchWinners).toEqual([B]);
  });
});
