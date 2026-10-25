import type { GameEvent, NewEvent } from '../../src/engine/events';
import { parseField } from '../../src/engine/types';
import {
  computeX01,
  confirmTurn,
  throwDart,
  undo,
  type InOut,
  type Race,
  type X01Settings,
  type X01Setup,
  type X01State,
} from '../../src/engine/x01';

/** Spielt ein X01-Spiel wie am Bildschirm: Darts eintragen, Weiter, Rückgängig. */
export class X01Game {
  events: GameEvent[] = [];
  private counter = 0;

  constructor(readonly setup: X01Setup) {}

  static create(opts: {
    start?: number;
    in?: InOut;
    out?: InOut;
    legs?: Race;
    sets?: Race | null;
    players?: number;
  }): X01Game {
    const settings: X01Settings = {
      startScore: opts.start ?? 501,
      inMode: opts.in ?? 'single',
      outMode: opts.out ?? 'double',
      legs: opts.legs ?? { count: 1, kind: 'firstTo' },
      sets: opts.sets ?? null,
    };
    const order = Array.from({ length: opts.players ?? 2 }, (_, i) => i);
    return new X01Game({ gameId: 'g1', settings, order });
  }

  get state(): X01State {
    return computeX01(this.setup, this.events);
  }

  add(events: NewEvent[]): string[] {
    return events.map((e) => {
      const id = `e${++this.counter}`;
      this.events.push({ ...e, id, ts: this.counter } as GameEvent);
      return id;
    });
  }

  /** Trägt Darts in Kurzschreibweise ein, z. B. throw('T20', 'S19', 'D16'). */
  throw(...fields: string[]): this {
    for (const f of fields) {
      const ev = throwDart(this.state, parseField(f));
      if (!ev) throw new Error(`Dart ${f} ist gerade nicht möglich`);
      this.add([ev]);
    }
    return this;
  }

  next(): this {
    const evs = confirmTurn(this.state);
    if (!evs.length) throw new Error('Weiter ist gerade nicht möglich');
    this.add(evs);
    return this;
  }

  /** Eine Aufnahme werfen und Weiter tippen. */
  turn(...fields: string[]): this {
    return this.throw(...fields).next();
  }

  undo(): this {
    this.add(undo(this.state));
    return this;
  }
}
