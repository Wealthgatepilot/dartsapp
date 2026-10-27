// Um die Plätze weiterspielen (SPEC 5.0), Gegenprüfung G79–G84.

import { describe, expect, it } from 'vitest';
import { DEFAULT_ATC, computeAtc, confirmAtcTurn, throwAtcDart, undoAtc } from '../../src/engine/atc';
import { decidePlayOn } from '../../src/engine/core';
import { DEFAULT_CRICKET, computeCricket, confirmCricketTurn, throwCricketDart } from '../../src/engine/cricket';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import { parseField } from '../../src/engine/types';
import { X01Game } from './helpers';

const [A, B, C, D] = [0, 1, 2, 3];

function x01(players: number, legs = 1, playOn = true) {
  const base = X01Game.create({ start: 40, players, legs: { count: legs, kind: 'firstTo' } });
  return new X01Game({ ...base.setup, playOn });
}

describe('X01: um die Plätze weiterspielen', () => {
  it('G79: 3 Spieler, A checkt → Frage; Beenden → B und C teilen Platz 2', () => {
    const g = x01(3).throw('D20');
    expect(g.state.askPlayOn).toBe(true);
    expect(g.state.finished).toBe(false);
    expect(g.state.matchWinner).toBe(A);
    expect(g.state.places).toEqual([[A]]);
    g.add(decidePlayOn(g.state, true));
    expect(g.state.finished).toBe(true);
    expect(g.state.askPlayOn).toBe(false);
    expect(g.state.places).toEqual([[A], [B, C]]);
  });

  it('G80: 4 Spieler, zweimal weiterspielen → Plätze A, C, B, D', () => {
    const g = x01(4).throw('D20');
    g.add(decidePlayOn(g.state, false));
    expect(g.state.askPlayOn).toBe(false);
    expect(g.state.next?.slot).toBe(B);
    g.turn('S1', 'S1', 'S1'); // B: 37
    g.throw('D20'); // C checkt → Platz 2
    expect(g.state.places).toEqual([[A], [C]]);
    expect(g.state.askPlayOn).toBe(true);
    g.add(decidePlayOn(g.state, false));
    expect(g.state.next?.slot).toBe(D); // A und C werden übersprungen
    g.turn('S1', 'S1', 'S1'); // D: 37
    g.throw('S17', 'D10'); // B checkt → Platz 3, D automatisch Platz 4
    expect(g.state.finished).toBe(true);
    expect(g.state.places).toEqual([[A], [C], [B], [D]]);
    // Nur der Sieger hat das Leg gewonnen
    expect(g.state.legsWon).toEqual({ 0: 1, 1: 0, 2: 0, 3: 0 });
    expect(g.state.matchWinners).toEqual([A]);
  });

  it('Rückgängig nimmt „Weiterspielen“ samt Weiter zurück, dann den Checkout', () => {
    const g = x01(3).throw('D20');
    g.add(decidePlayOn(g.state, false));
    expect(g.state.askPlayOn).toBe(false);
    g.undo();
    expect(g.state.askPlayOn).toBe(true);
    expect(g.state.awaitingConfirm).toBe(true);
    g.undo();
    expect(g.state.askPlayOn).toBe(false);
    expect(g.state.matchWinner).toBeNull();
    expect(g.state.next?.slot).toBe(A);
  });

  it('G81: 2 Spieler → keine Frage', () => {
    const g = x01(2).throw('D20');
    expect(g.state.askPlayOn).toBe(false);
    expect(g.state.finished).toBe(true);
    expect(g.state.places).toBeNull();
  });

  it('G82: first to 2 → nach dem 1. Leg keine Frage, erst nach dem Match', () => {
    const g = x01(3, 2).throw('D20').next();
    expect(g.state.askPlayOn).toBe(false);
    expect(g.state.legs).toHaveLength(2);
    // Leg 2 beginnt B
    g.turn('S1', 'S1', 'S1').turn('S1', 'S1', 'S1').throw('D20'); // B, C, dann A checkt
    expect(g.state.matchWinner).toBe(A);
    expect(g.state.askPlayOn).toBe(true);
  });

  it('ältere Spiele ohne Vermerk: keine Frage, Spiel vorbei', () => {
    const g = x01(3, 1, false).throw('D20');
    expect(g.state.askPlayOn).toBe(false);
    expect(g.state.finished).toBe(true);
    expect(g.state.places).toBeNull();
  });
});

class Game<S> {
  events: GameEvent[] = [];
  private n = 0;
  constructor(
    private compute: (evs: GameEvent[]) => S,
    private dart: (s: S, f: string) => NewEvent | null,
    private confirm: (s: S) => NewEvent[],
  ) {}
  get state() {
    return this.compute(this.events);
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  throw(...fs: string[]) {
    for (const f of fs) {
      const ev = this.dart(this.state, f);
      if (!ev) throw new Error(`Dart ${f} nicht möglich`);
      this.add([ev]);
    }
    return this;
  }
  turn(...fs: string[]) {
    return this.throw(...fs).add(this.confirm(this.state));
  }
}

describe('Cricket und Around the Clock', () => {
  it('G83: Cricket – der Sieger zählt beim Punktevergleich um Platz 2 nicht mehr', () => {
    const settings = { ...DEFAULT_CRICKET, targets: [20, 19] };
    const g = new Game(
      (evs) => computeCricket({ gameId: 'c1', settings, order: [A, B, C], playOn: true }, evs),
      (s, f) => throwCricketDart(s, parseField(f)),
      (s) => confirmCricketTurn(s),
    );
    g.throw('T20', 'T20', 'T19'); // A: alles zu, 60 Punkte → Sieg
    expect(g.state.askPlayOn).toBe(true);
    g.add(decidePlayOn(g.state, false));
    g.throw('T20', 'T19'); // B: alles zu, 0 Punkte, C auch 0 → B ist Zweiter (A zählt nicht mehr)
    expect(g.state.places).toEqual([[A], [B], [C]]);
    expect(g.state.finished).toBe(true);
    expect(g.state.currentTurn!.darts).toHaveLength(2); // die Aufnahme endet mit dem Platz
  });

  it('G84: Around the Clock – Rückgängig nach „Weiterspielen“ bringt die Frage zurück', () => {
    const settings = { ...DEFAULT_ATC };
    const g = new Game(
      (evs) => computeAtc({ gameId: 'a1', settings, order: [A, B, C], playOn: true }, evs),
      (s, f) => throwAtcDart(s, parseField(f)),
      (s) => confirmAtcTurn(s),
    );
    // A trifft 1–20 in 7 Aufnahmen, B und C werfen daneben
    const hits = Array.from({ length: 20 }, (_, i) => `S${i + 1}`);
    for (let t = 0; t < 7; t++) {
      g.turn(...hits.slice(t * 3, t * 3 + 3));
      if (g.state.askPlayOn) break;
      g.turn('0', '0', '0').turn('0', '0', '0');
    }
    expect(g.state.matchWinner).toBe(A);
    expect(g.state.askPlayOn).toBe(true);
    g.add(decidePlayOn(g.state, false));
    expect(g.state.next?.slot).toBe(B);
    g.add(undoAtc(g.state));
    expect(g.state.askPlayOn).toBe(true);
  });
});
