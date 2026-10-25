// X01-Regeln nach SPEC 7.1. Die Nummern G1 … G38 sind die Gegenprüfungsfälle aus SPEC 14.2.
// „Rest 32“ wird mit Startwert 32 nachgestellt: Für die Regeln ist das dasselbe.

import { describe, expect, it } from 'vitest';
import { parseField } from '../../src/engine/types';
import { planEdit, throwDart, validateSettings, winsNeeded } from '../../src/engine/x01';
import { X01Game } from './helpers';

const A = 0;
const B = 1;

function currentTurn(g: X01Game) {
  return g.state.currentTurn!;
}

describe('Bust und Checkout bei Double-Out', () => {
  it('G1: Rest 32, S20 S11 → Rest wäre 1 → Bust, Aufnahme endet nach Dart 2', () => {
    const g = X01Game.create({ start: 32 }).throw('S20', 'S11');
    const t = currentTurn(g);
    expect(t.bust).toBe(true);
    expect(t.darts).toHaveLength(2);
    expect(t.complete).toBe(true);
    expect(g.state.remaining[A]).toBe(32);
    expect(g.state.awaitingConfirm).toBe(true);
    expect(throwDart(g.state, parseField('S1'))).toBeNull();
  });

  it('G2: Rest 32, T20 → unter 0 → Bust', () => {
    const g = X01Game.create({ start: 32 }).throw('T20');
    expect(currentTurn(g).bust).toBe(true);
    expect(g.state.remaining[A]).toBe(32);
  });

  it('G3: Rest 32, S16 S16 → 0 ohne Double → Bust', () => {
    const g = X01Game.create({ start: 32 }).throw('S16', 'S16');
    expect(currentTurn(g).bust).toBe(true);
    expect(g.state.remaining[A]).toBe(32);
  });

  it('G4: Rest 32, D16 → Checkout', () => {
    const g = X01Game.create({ start: 32 }).throw('D16');
    expect(currentTurn(g).checkout).toBe(true);
    expect(g.state.legs[0].winner).toBe(A);
    expect(g.state.matchWinner).toBe(A);
  });

  it('G5: Rest 50, Bullseye → Checkout (Bull gilt als Double)', () => {
    const g = X01Game.create({ start: 50 }).throw('DB');
    expect(currentTurn(g).checkout).toBe(true);
  });

  it('G6: Rest 25, Single-Bull → Bust', () => {
    const g = X01Game.create({ start: 25 }).throw('SB');
    expect(currentTurn(g).bust).toBe(true);
  });

  it('Rest 2, D1 → Checkout; Rest 3, S1 → Rest 2, kein Bust', () => {
    expect(currentTurn(X01Game.create({ start: 2 }).throw('D1')).checkout).toBe(true);
    const g = X01Game.create({ start: 3 }).throw('S1');
    expect(currentTurn(g).bust).toBe(false);
    expect(g.state.remaining[A]).toBe(2);
  });

  it('Checkout mit Dart 1 beendet die Aufnahme sofort', () => {
    const g = X01Game.create({ start: 40 }).throw('D20');
    expect(currentTurn(g).darts).toHaveLength(1);
    expect(g.state.next).toBeNull();
  });
});

describe('Single-Out und Master-Out', () => {
  it('G7: Single-Out, Rest 1, S1 → Checkout', () => {
    const g = X01Game.create({ start: 1, out: 'single' }).throw('S1');
    expect(currentTurn(g).checkout).toBe(true);
  });

  it('G8: Single-Out, Rest 20, S19 → Rest 1, kein Bust', () => {
    const g = X01Game.create({ start: 20, out: 'single' }).throw('S19');
    expect(currentTurn(g).bust).toBe(false);
    expect(g.state.remaining[A]).toBe(1);
  });

  it('Single-Out, unter 0 bleibt Bust', () => {
    const g = X01Game.create({ start: 20, out: 'single' }).throw('T20');
    expect(currentTurn(g).bust).toBe(true);
  });

  it('G9: Master-Out, Rest 60, T20 → Checkout', () => {
    const g = X01Game.create({ start: 60, out: 'master' }).throw('T20');
    expect(currentTurn(g).checkout).toBe(true);
  });

  it('Master-Out, Rest 50, Bullseye → Checkout; Rest 20, S20 → Bust', () => {
    expect(currentTurn(X01Game.create({ start: 50, out: 'master' }).throw('DB')).checkout).toBe(true);
    expect(currentTurn(X01Game.create({ start: 20, out: 'master' }).throw('S20')).bust).toBe(true);
  });

  it('G10: Master-Out, Rest 3, S2 → Rest 1 → Bust', () => {
    const g = X01Game.create({ start: 3, out: 'master' }).throw('S2');
    expect(currentTurn(g).bust).toBe(true);
    expect(g.state.remaining[A]).toBe(3);
  });
});

describe('Double-In und Master-In', () => {
  it('G11: S20 T20 D10 → nur D10 zählt: Rest 481', () => {
    const g = X01Game.create({ in: 'double' }).throw('S20', 'T20', 'D10');
    expect(g.state.remaining[A]).toBe(481);
    expect(g.state.isIn[A]).toBe(true);
  });

  it('G12: D20 S20 T20 → alle zählen: Rest 381', () => {
    const g = X01Game.create({ in: 'double' }).throw('D20', 'S20', 'T20');
    expect(g.state.remaining[A]).toBe(381);
  });

  it('G13: Bullseye bringt rein und zählt 50: Rest 451', () => {
    const g = X01Game.create({ in: 'double' }).throw('DB');
    expect(g.state.remaining[A]).toBe(451);
  });

  it('Single-Bull bringt bei Double-In nicht rein', () => {
    const g = X01Game.create({ in: 'double' }).throw('SB');
    expect(g.state.remaining[A]).toBe(501);
    expect(g.state.isIn[A]).toBe(false);
  });

  it('G14: noch nicht drin, S20 S20 S20 → Rest 501, kein Bust', () => {
    const g = X01Game.create({ in: 'double' }).throw('S20', 'S20', 'S20');
    expect(g.state.remaining[A]).toBe(501);
    expect(currentTurn(g).bust).toBe(false);
    expect(g.state.isIn[A]).toBe(false);
  });

  it('G15: Startwert 40, Double-In: D10 bringt rein, T20 bustet → Rest 40, wieder „nicht drin“', () => {
    const g = X01Game.create({ start: 40, in: 'double' }).throw('D10', 'T20');
    expect(currentTurn(g).bust).toBe(true);
    expect(g.state.remaining[A]).toBe(40);
    expect(g.state.isIn[A]).toBe(false);
  });

  it('Drin-Status bleibt über Aufnahmen erhalten', () => {
    const g = X01Game.create({ in: 'double' }).turn('D20', '0', '0').turn('0', '0', '0').throw('S20');
    expect(g.state.remaining[A]).toBe(441);
  });

  it('Master-In: Triple bringt rein, Single nicht', () => {
    const g = X01Game.create({ in: 'master' }).throw('S20', 'T19', 'S1');
    expect(g.state.remaining[A]).toBe(501 - 57 - 1);
  });
});

describe('Spielablauf', () => {
  it('Spieler wechseln erst nach Weiter', () => {
    const g = X01Game.create({}).throw('T20', 'T20', 'T20');
    expect(g.state.awaitingConfirm).toBe(true);
    expect(g.state.next).toBeNull();
    g.next();
    expect(g.state.next).toMatchObject({ slot: B, turnIndex: 1, dartIndex: 1 });
    expect(g.state.remaining[A]).toBe(321);
  });

  it('Weiter nach 1 Dart füllt mit 2 Fehlwürfen auf', () => {
    const g = X01Game.create({}).throw('S20').next();
    const t = g.state.legs[0].turns[0];
    expect(t.darts.map((d) => d.input)).toEqual(['board', 'auto', 'auto']);
    expect(g.state.remaining[A]).toBe(481);
  });

  it('Weiter nach Bust füllt nicht auf', () => {
    const g = X01Game.create({ start: 32 }).throw('T20').next();
    expect(g.state.legs[0].turns[0].darts).toHaveLength(1);
    expect(g.state.next).toMatchObject({ slot: B });
  });

  it('drei Spieler werfen reihum', () => {
    const g = X01Game.create({ players: 3 }).turn('S1', 'S1', 'S1').turn('S2', 'S2', 'S2').turn('S3', 'S3', 'S3');
    expect(g.state.next).toMatchObject({ slot: A, turnIndex: 2 });
    expect(g.state.remaining).toEqual({ 0: 498, 1: 495, 2: 492 });
  });

  it('bei mehr als 2 Spielern endet das Leg mit dem ersten Checkout', () => {
    const g = X01Game.create({ start: 40, players: 3, legs: { count: 2, kind: 'firstTo' } })
      .turn('0', '0', '0')
      .throw('D20');
    expect(g.state.legs[0].winner).toBe(B);
    g.next();
    expect(g.state.legs).toHaveLength(2);
  });
});

describe('Legs, Sets, Anwurf', () => {
  it('„best of“ heißt „first to (N+1)/2“', () => {
    expect(winsNeeded({ count: 5, kind: 'bestOf' })).toBe(3);
    expect(winsNeeded({ count: 1, kind: 'bestOf' })).toBe(1);
    expect(winsNeeded({ count: 3, kind: 'firstTo' })).toBe(3);
  });

  it('„best of“ mit gerader Zahl ist nicht erlaubt', () => {
    const s = X01Game.create({ legs: { count: 4, kind: 'bestOf' } }).setup.settings;
    expect(validateSettings(s)).toHaveLength(1);
    expect(validateSettings({ ...s, legs: { count: 5, kind: 'bestOf' } })).toEqual([]);
    expect(validateSettings({ ...s, startScore: 1 })).toHaveLength(2);
  });

  it('Anwurf wechselt Leg für Leg', () => {
    const g = X01Game.create({ start: 2, legs: { count: 3, kind: 'firstTo' } });
    g.turn('D1'); // Leg 1: A beginnt und gewinnt
    expect(g.state.next).toMatchObject({ leg: 2, slot: B, turnIndex: 1 });
    g.turn('D1'); // Leg 2: B beginnt und gewinnt
    expect(g.state.next).toMatchObject({ leg: 3, slot: A });
    expect(g.state.legsWon).toEqual({ 0: 1, 1: 1 });
    expect(g.state.remaining).toEqual({ 0: 2, 1: 2 });
  });

  it('first to 2 Legs: Match endet beim zweiten Leg-Gewinn', () => {
    const g = X01Game.create({ start: 2, legs: { count: 2, kind: 'firstTo' } });
    g.turn('D1').turn('0', '0', '0').turn('D1'); // Leg 1 A, Leg 2: B verfehlt, A checkt
    expect(g.state.matchWinner).toBe(A);
    expect(g.state.legsWon).toEqual({ 0: 2, 1: 0 });
    expect(g.state.next).toBeNull();
  });

  it('Sets: best of 3 Sets, first to 2 Legs pro Set', () => {
    const g = X01Game.create({
      start: 2,
      legs: { count: 2, kind: 'firstTo' },
      sets: { count: 3, kind: 'bestOf' },
    });
    // In jedem Leg checkt der Anwerfer sofort. Anwurf: A, B, A, B, A, B, A, B, A
    for (let i = 0; i < 9; i++) {
      expect(g.state.matchWinner).toBeNull();
      g.turn('D1');
    }
    expect(g.state.setsWon).toEqual({ 0: 2, 1: 1 });
    expect(g.state.matchWinner).toBe(A);
    expect(g.state.legs.map((l) => l.set)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });
});

describe('Rückgängig', () => {
  it('G36: nimmt erst Weiter zurück, dann Dart 3', () => {
    const g = X01Game.create({}).turn('T20', 'T19', 'T18');
    expect(g.state.next).toMatchObject({ slot: B });
    g.undo();
    expect(g.state.awaitingConfirm).toBe(true);
    expect(currentTurn(g).slot).toBe(A);
    g.undo();
    expect(currentTurn(g).darts.map((d) => d.field)).toEqual([parseField('T20'), parseField('T19')]);
    expect(g.state.next).toMatchObject({ slot: A, dartIndex: 3 });
  });

  it('nimmt Weiter samt aufgefüllter Darts in einem Schritt zurück', () => {
    const g = X01Game.create({}).throw('S20').next().undo();
    expect(currentTurn(g).darts).toHaveLength(1);
    expect(g.state.next).toMatchObject({ slot: A, dartIndex: 2 });
  });

  it('G37: Rückgängig nach Checkout öffnet das Leg wieder', () => {
    const g = X01Game.create({ start: 32, legs: { count: 2, kind: 'firstTo' } }).turn('D16');
    expect(g.state.legs).toHaveLength(2);
    g.undo(); // Weiter
    expect(g.state.legs).toHaveLength(1);
    expect(g.state.legsWon[A]).toBe(1);
    g.undo(); // Checkout-Dart
    expect(g.state.legsWon[A]).toBe(0);
    expect(g.state.legs[0].winner).toBeNull();
    expect(g.state.next).toMatchObject({ leg: 1, slot: A, dartIndex: 1 });
  });

  it('geht beliebig weit zurück, bis zum Spielbeginn', () => {
    const g = X01Game.create({}).turn('S1', 'S2', 'S3').turn('S4', 'S5', 'S6');
    for (let i = 0; i < 8; i++) g.undo();
    expect(g.state.next).toMatchObject({ leg: 1, slot: A, turnIndex: 1, dartIndex: 1 });
    expect(g.state.remaining).toEqual({ 0: 501, 1: 501 });
    g.undo(); // nichts mehr da
    expect(g.state.next).toMatchObject({ slot: A, dartIndex: 1 });
  });

  it('widerrufene Darts bleiben gespeichert', () => {
    const g = X01Game.create({}).throw('T20').undo();
    expect(g.events.filter((e) => e.type === 'dart.thrown')).toHaveLength(1);
    expect(g.events.filter((e) => e.type === 'event.voided')).toHaveLength(1);
  });
});

describe('Runde bearbeiten', () => {
  it('ersetzt einen Dart, spätere Aufnahmen bleiben', () => {
    const g = X01Game.create({}).turn('S20', 'S20', 'S20').turn('S1', 'S1', 'S1').throw('S5');
    const plan = planEdit(g.state, g.events, { leg: 1, slot: A, turnIndex: 1 }, ['S20', 'T20', 'S20'].map(parseField));
    expect(plan.error).toBeUndefined();
    expect(plan.discarded).toEqual([]);
    expect(plan.outcomeChanged).toBe(false); // nur andere Punktzahl, kein Bust oder Checkout
    g.add(plan.events);
    expect(g.state.remaining[A]).toBe(501 - 100 - 5);
    expect(g.state.next).toMatchObject({ slot: A, turnIndex: 2, dartIndex: 2 });
    expect(g.state.ignored).toEqual([]);
  });

  it('der ersetzende Dart verweist auf den alten', () => {
    const g = X01Game.create({}).turn('S20', 'S20', 'S20');
    const old = g.state.legs[0].turns[0].darts[1].id;
    const plan = planEdit(g.state, g.events, { leg: 1, slot: A, turnIndex: 1 }, ['S20', 'D20', 'S20'].map(parseField));
    const replacement = plan.events.find((e) => e.type === 'dart.thrown')!;
    expect(replacement.payload).toMatchObject({ dartIndex: 2, replaces: old });
  });

  it('entfernt Darts einer bestätigten Aufnahme → wird mit Fehlwürfen aufgefüllt', () => {
    const g = X01Game.create({}).turn('S20', 'S20', 'S20');
    g.add(planEdit(g.state, g.events, { leg: 1, slot: A, turnIndex: 1 }, [parseField('S20')]).events);
    const t = g.state.legs[0].turns[0];
    expect(t.darts.map((d) => d.input)).toEqual(['board', 'auto', 'auto']);
    expect(g.state.remaining[A]).toBe(481);
  });

  it('G38: Bearbeitung erzeugt früheren Checkout → spätere Darts werden verworfen', () => {
    const g = X01Game.create({ start: 60 })
      .turn('S20', 'S20', 'S10') // A: Rest 10
      .turn('S5', 'S5', 'S5') // B
      .turn('S2', 'S4', 'S2') // A: Rest 2
      .throw('S1'); // B
    const plan = planEdit(g.state, g.events, { leg: 1, slot: A, turnIndex: 1 }, ['S20', 'S20', 'D10'].map(parseField));
    expect(plan.outcomeChanged).toBe(true);
    const laterDarts = g.state.legs[0].turns.slice(1).flatMap((t) => t.darts.map((d) => d.id));
    expect(laterDarts).toHaveLength(7);
    for (const id of laterDarts) expect(plan.discarded).toContain(id);
    g.add(plan.events);
    expect(g.state.matchWinner).toBe(A);
    expect(g.state.ignored).toEqual([]);
  });

  it('Bearbeitung, die einen Bust erzeugt, ändert den Ausgang', () => {
    const g = X01Game.create({ start: 60 }).turn('S20', 'S20', 'S10');
    const plan = planEdit(g.state, g.events, { leg: 1, slot: A, turnIndex: 1 }, ['T20', 'S20', 'S10'].map(parseField));
    expect(plan.outcomeChanged).toBe(true);
    g.add(plan.events);
    const t = g.state.legs[0].turns[0];
    expect(t.bust).toBe(true);
    expect(t.darts).toHaveLength(1); // nach dem Bust-Dart gibt es keine weiteren
    expect(g.state.remaining[A]).toBe(60);
  });

  it('nur das laufende Leg ist bearbeitbar', () => {
    const g = X01Game.create({ start: 2, legs: { count: 2, kind: 'firstTo' } }).turn('D1');
    const plan = planEdit(g.state, g.events, { leg: 1, slot: A, turnIndex: 1 }, [parseField('S1')]);
    expect(plan.error).toBeDefined();
    expect(plan.events).toEqual([]);
  });
});

describe('Unmögliche Darts (SPEC 3.5)', () => {
  it('ein Dart nach einem Bust wird ignoriert, aber nicht gelöscht', () => {
    const g = X01Game.create({ start: 32 }).throw('T20');
    g.add([
      {
        type: 'dart.thrown',
        payload: { gameId: 'g1', slot: A, leg: 1, set: 1, turnIndex: 1, dartIndex: 2, field: parseField('S1'), input: 'board' },
      },
    ]);
    expect(g.state.ignored).toHaveLength(1);
    expect(g.state.remaining[A]).toBe(32);
  });

  it('ein vierter Dart wird ignoriert', () => {
    const g = X01Game.create({}).throw('S1', 'S1', 'S1');
    g.add([
      {
        type: 'dart.thrown',
        payload: { gameId: 'g1', slot: A, leg: 1, set: 1, turnIndex: 1, dartIndex: 4, field: parseField('S1'), input: 'board' },
      },
    ]);
    expect(g.state.ignored.map((i) => i.reason)).toEqual(['ungültige Angaben']);
    expect(g.state.remaining[A]).toBe(498);
  });
});
