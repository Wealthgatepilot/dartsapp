// Bob's 27 nach SPEC 7.8, Gegenprüfung G45–G47.

import { describe, expect, it } from 'vitest';
import {
  BOBS_TARGETS,
  DEFAULT_BOBS,
  computeBobs,
  confirmBobsTurn,
  throwBobsDart,
  undoBobs,
  type BobsSettings,
  type BobsState,
} from '../../src/engine/bobs';
import type { GameEvent, NewEvent } from '../../src/engine/events';

const A = 0;
const B = 1;

class Bobs {
  events: GameEvent[] = [];
  private n = 0;
  constructor(
    readonly settings: BobsSettings,
    readonly players = 1,
  ) {}
  static create(patch: Partial<BobsSettings> = {}, players = 1) {
    return new Bobs({ ...DEFAULT_BOBS, ...patch }, players);
  }
  get state(): BobsState {
    return computeBobs({ gameId: 'b1', settings: this.settings, order: [...Array(this.players).keys()] }, this.events);
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  /** „+“ = Treffer, „-“ = Falsch, danach Weiter. */
  turn(code: string) {
    for (const c of code) {
      const ev = throwBobsDart(this.state, c === '+');
      if (!ev) throw new Error('Dart nicht möglich');
      this.add([ev]);
    }
    return this.add(confirmBobsTurn(this.state));
  }
}

describe("Bob's 27", () => {
  it('21 Ziele: D1 bis D20 und Bullseye', () => {
    expect(BOBS_TARGETS).toHaveLength(21);
    expect(BOBS_TARGETS[20]).toEqual({ n: 25, m: 2 });
  });

  it('G45: keine Treffer auf D1 → 27 − 2 = 25', () => {
    const g = Bobs.create().turn('---');
    expect(g.state.score[A]).toBe(25);
    expect(g.state.target).toEqual({ n: 2, m: 2 });
  });

  it('G46: zwei Treffer auf D1 → 31, kein Abzug', () => {
    expect(Bobs.create().turn('+-+').state.score[A]).toBe(31);
  });

  it('„Weiter“ nach einem Dart füllt mit Falsch auf; ohne Treffer wird abgezogen', () => {
    const g = Bobs.create();
    g.add([throwBobsDart(g.state, false)!]).add(confirmBobsTurn(g.state));
    expect(g.state.score[A]).toBe(25);
    g.add(undoBobs(g.state));
    expect(g.state.score[A]).toBe(27);
    expect(g.state.currentTurn!.darts).toHaveLength(1);
  });

  it('G47: ausscheiden bei 0 oder weniger – sonst geht es weiter', () => {
    const out = Bobs.create({ dieAtZero: true }, 2);
    const scores: number[] = [];
    for (let i = 0; i < 5; i++) {
      out.turn('---').turn('+--');
      scores.push(out.state.score[A]);
    }
    expect(scores).toEqual([25, 21, 15, 7, -3]);
    expect(out.state.legs[0].state.out).toEqual([A]);
    // A wird übersprungen, B wirft weiter
    expect(out.state.next?.slot).toBe(B);

    const on = Bobs.create({ dieAtZero: false });
    for (let i = 0; i < 5; i++) on.turn('---');
    expect(on.state.score[A]).toBe(-3);
    expect(on.state.target).toEqual({ n: 6, m: 2 });
  });

  it('nach dem Bullseye ist Schluss; meiste Punkte gewinnen', () => {
    const g = Bobs.create({ dieAtZero: false }, 2);
    for (let i = 0; i < 21; i++) g.turn('+--').turn('---');
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinners).toEqual([A]);
    // A: 27 + 2+4+…+40 + 50 = 27 + 420 + 50
    expect(g.state.score[A]).toBe(497);
  });
});
