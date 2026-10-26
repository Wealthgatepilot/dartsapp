// Ansagetexte der Sprachausgabe (SPEC 10).

import { describe, expect, it } from 'vitest';
import { matchCallout, turnCallout } from '../../src/engine/callout';
import { computeCricket, DEFAULT_CRICKET, throwCricketDart } from '../../src/engine/cricket';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import { parseField } from '../../src/engine/types';
import { X01Game } from './helpers';

const names = ['Gian', 'Jörn'];
const nameOf = (s: number) => names[s];

describe('X01', () => {
  it('Punkte der Aufnahme; steht der Nächste auf einem Finish: „…, du brauchst …“', () => {
    const g = X01Game.create({ start: 101 }).turn('S20', 'S20', 'S1'); // Gian 41 → Rest 60
    // Jörn wirft 60 (Rest 41): angesagt wird 60, dann Gian braucht 60
    g.throw('S20', 'S20', 'S20');
    const turn = g.state.currentTurn!;
    expect(turnCallout({ mode: 'x01', state: g.state }, turn, nameOf)).toBe('60. Gian, du brauchst 60');
  });

  it('ohne Finish beim Nächsten nur die Punkte; Bust; Game Shot', () => {
    const g = X01Game.create({}).throw('T20', 'T20', 'T20');
    expect(turnCallout({ mode: 'x01', state: g.state }, g.state.currentTurn, nameOf)).toBe('180');
    const b = X01Game.create({ start: 32 }).throw('T20');
    expect(turnCallout({ mode: 'x01', state: b.state }, b.state.currentTurn, nameOf)).toMatch(/^Bust/);
    const c = X01Game.create({ start: 40, legs: { count: 2, kind: 'firstTo' } }).throw('D20');
    expect(turnCallout({ mode: 'x01', state: c.state }, c.state.currentTurn, nameOf)).toBe('Game Shot');
  });

  it('Spielende: Game Shot und das Match', () => {
    const g = X01Game.create({ start: 40 }).throw('D20');
    expect(matchCallout({ mode: 'x01', state: g.state }, nameOf)).toBe('Game Shot und das Match. Gian gewinnt');
  });
});

describe('Cricket', () => {
  it('Marks der Aufnahme', () => {
    const events: GameEvent[] = [];
    const setup = { gameId: 'c', settings: DEFAULT_CRICKET, order: [0, 1] };
    let n = 0;
    const add = (e: NewEvent | null) => events.push({ ...e!, id: `e${++n}`, ts: n } as GameEvent);
    for (const f of ['T20', 'S19', '0']) add(throwCricketDart(computeCricket(setup, events), parseField(f)));
    const s = computeCricket(setup, events);
    expect(turnCallout({ mode: 'cricket', state: s }, s.currentTurn, nameOf)).toBe('4 Marks');
  });
});
