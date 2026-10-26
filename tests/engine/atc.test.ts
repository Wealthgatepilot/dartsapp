// Around the Clock nach SPEC 7.5, Gegenprüfung G42–G44.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ATC,
  atcAdvance,
  computeAtc,
  confirmAtcTurn,
  throwAtcDart,
  undoAtc,
  type AtcSettings,
  type AtcState,
} from '../../src/engine/atc';
import type { GameEvent, NewEvent } from '../../src/engine/events';
import { BULL, parseField } from '../../src/engine/types';

const A = 0;
const B = 1;

class Atc {
  events: GameEvent[] = [];
  private n = 0;
  constructor(
    readonly settings: AtcSettings,
    readonly players = 2,
  ) {}
  static create(patch: Partial<AtcSettings> = {}, players = 2) {
    return new Atc({ ...DEFAULT_ATC, ...patch }, players);
  }
  get state(): AtcState {
    return computeAtc({ gameId: 'a1', settings: this.settings, order: [...Array(this.players).keys()] }, this.events);
  }
  add(evs: NewEvent[]) {
    for (const e of evs) this.events.push({ ...e, id: `e${++this.n}`, ts: this.n } as GameEvent);
    return this;
  }
  throw(...fs: string[]) {
    for (const f of fs) {
      const ev = throwAtcDart(this.state, parseField(f));
      if (!ev) throw new Error(`Dart ${f} nicht möglich`);
      this.add([ev]);
    }
    return this;
  }
  turn(...fs: string[]) {
    return this.throw(...fs).add(confirmAtcTurn(this.state));
  }
}

/** Spieler A bis Ziel `n` bringen (B wirft daneben). */
function upTo(g: Atc, n: number) {
  for (let k = 1; k < n; k += 3) {
    const darts = [k, k + 1, k + 2].filter((x) => x < n).map((x) => `S${x}`);
    g.turn(...darts).turn('0', '0', '0');
  }
  return g;
}

describe('Around the Clock', () => {
  it('G42: S1, D2, T5 → nächstes Ziel 3, 2 Treffer', () => {
    const g = Atc.create().throw('S1', 'D2', 'T5');
    expect(g.state.targetOf(A)).toBe(3);
    expect(g.state.currentTurn!.hits).toBe(2);
  });

  it('G43: mit Sprüngen T1 → Ziel 4; D19 am Ziel 19 → über das Ende hinaus gewonnen', () => {
    expect(Atc.create({ jumps: true }).throw('T1').state.targetOf(A)).toBe(4);
    const g = upTo(Atc.create({ jumps: true }), 19);
    expect(g.state.targetOf(A)).toBe(19);
    g.throw('D19');
    expect(g.state.finished).toBe(true);
    expect(g.state.matchWinners).toEqual([A]);
    expect(g.state.targetOf(A)).toBeNull();
  });

  it('Sprünge nur bei Ring „beliebig“', () => {
    expect(Atc.create({ jumps: true, ring: 'double' }).throw('D1').state.targetOf(A)).toBe(2);
  });

  it('G44: nur Doubles → S1 zählt nicht, D1 schon; nur Triples mit Bull → am Bull zählt das Bullseye', () => {
    const d = Atc.create({ ring: 'double' }).throw('S1', 'T1', 'D1');
    expect(d.state.targetOf(A)).toBe(2);
    const triple = { ...DEFAULT_ATC, withBull: true, ring: 'triple' as const };
    expect(atcAdvance(triple, BULL, parseField('DB'))).toBe(1);
    expect(atcAdvance(triple, BULL, parseField('SB'))).toBe(0);
    expect(atcAdvance(triple, 7, parseField('D7'))).toBe(0);
    expect(atcAdvance(triple, 7, parseField('T7'))).toBe(1);
    const bull = Atc.create({ withBull: true });
    expect(upTo(Atc.create({ withBull: true }), 21).state.targetOf(A)).toBe(BULL);
    upTo(bull, 21).throw('SB');
    expect(bull.state.matchWinners).toEqual([A]);
  });

  it('wer das letzte Ziel trifft, gewinnt sofort, auch mit Dart 1', () => {
    const g = upTo(Atc.create(), 20);
    g.throw('S20');
    expect(g.state.finished).toBe(true);
    expect(g.state.currentTurn!.darts).toHaveLength(1);
    g.add(undoAtc(g.state));
    expect(g.state.finished).toBe(false);
    expect(g.state.targetOf(A)).toBe(20);
    expect(g.state.targetOf(B)).toBe(1);
  });
});
