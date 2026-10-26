// Spiele aus Ereignissen: Liste, Reihenfolge, laufendes Spiel (SPEC 5).

import { computeBobs, type BobsSetup, type BobsState } from './bobs';
import { atcVariantLabel, computeAtc, type AtcSetup, type AtcState } from './atc';
import { computeCountUp, type CountUpSetup, type CountUpState } from './countup';
import { computeCricket, type CricketSetup, type CricketState } from './cricket';
import { computeOne21, type One21Setup, type One21State } from './one21';
import { computeHalveIt, type HalveItSetup, type HalveItState } from './halveit';
import { computeDoubles, type DoublesSetup, type DoublesState } from './doubles';
import { computeShanghai, type ShanghaiSetup, type ShanghaiState } from './shanghai';
import { gameEventsOf, type AppEvent, type GameCreatedPayload } from './events';
import { computeX01, type X01Setup, type X01State } from './x01';

export interface GameInfo {
  created: GameCreatedPayload;
  createdAt: number;
  order: number[];
  ended: 'finished' | 'abandoned' | null;
  hidden: boolean;
  /** Reihenfolge steht fest (game.orderDecided). Bis dahin läuft Ausbullen bzw. Münzwurf. */
  orderDecided: boolean;
}

export function listGames(events: readonly AppEvent[]): GameInfo[] {
  const games = new Map<string, GameInfo>();
  for (const e of events) {
    if (e.type === 'game.created') {
      if (!games.has(e.payload.gameId)) {
        games.set(e.payload.gameId, {
          created: e.payload,
          createdAt: e.ts,
          order: e.payload.participants.map((p) => p.slot),
          ended: null,
          hidden: false,
          orderDecided: false,
        });
      }
      continue;
    }
    const g =
      e.type === 'game.orderDecided' || e.type === 'game.ended' || e.type === 'game.hidden'
        ? games.get(e.payload.gameId)
        : undefined;
    if (!g) continue;
    if (e.type === 'game.orderDecided') {
      g.order = e.payload.order;
      g.orderDecided = true;
    }
    if (e.type === 'game.ended' && !g.ended) g.ended = e.payload.reason;
    if (e.type === 'game.hidden') g.hidden = true;
  }
  return [...games.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/** Das zuletzt begonnene Spiel, das noch nicht beendet ist (für „Spiel fortsetzen?“). */
export function unfinishedGame(events: readonly AppEvent[]): GameInfo | null {
  return listGames(events).find((g) => !g.ended && !g.hidden) ?? null;
}

export function x01SetupOf(game: GameInfo): X01Setup {
  const c = game.created;
  if (c.mode !== 'x01') throw new Error('Kein X01-Spiel');
  const startScores: Record<number, number> = {};
  for (const p of c.participants) if (p.startScore) startScores[p.slot] = p.startScore;
  return {
    gameId: c.gameId,
    settings: c.settings,
    order: game.order,
    ...(Object.keys(startScores).length ? { startScores } : {}),
  };
}

export function cricketSetupOf(game: GameInfo): CricketSetup {
  const c = game.created;
  if (c.mode !== 'cricket') throw new Error('Kein Cricket-Spiel');
  return { gameId: c.gameId, settings: c.settings, order: game.order };
}

export function shanghaiSetupOf(game: GameInfo): ShanghaiSetup {
  const c = game.created;
  if (c.mode !== 'shanghai') throw new Error('Kein Shanghai-Spiel');
  return { gameId: c.gameId, settings: c.settings, order: game.order };
}

export function doublesSetupOf(game: GameInfo): DoublesSetup {
  const c = game.created;
  if (c.mode !== 'doubles') throw new Error('Kein Doppelfeld-Training');
  return { gameId: c.gameId, settings: c.settings, order: game.order, seed: c.seed };
}

export function countUpSetupOf(game: GameInfo): CountUpSetup {
  const c = game.created;
  if (c.mode !== 'countup') throw new Error('Kein Count-Up-Spiel');
  return { gameId: c.gameId, settings: c.settings, order: game.order };
}

export function atcSetupOf(game: GameInfo): AtcSetup {
  const c = game.created;
  if (c.mode !== 'atc') throw new Error('Kein Around-the-Clock-Spiel');
  return { gameId: c.gameId, settings: c.settings, order: game.order };
}

export function bobsSetupOf(game: GameInfo): BobsSetup {
  const c = game.created;
  if (c.mode !== 'bobs') throw new Error("Kein Bob's-27-Spiel");
  return { gameId: c.gameId, settings: c.settings, order: game.order };
}

export function halveItSetupOf(game: GameInfo): HalveItSetup {
  const c = game.created;
  if (c.mode !== 'halveit') throw new Error('Kein Halve-It-Spiel');
  return { gameId: c.gameId, settings: c.settings, order: game.order };
}

export function one21SetupOf(game: GameInfo): One21Setup {
  const c = game.created;
  if (c.mode !== 'one21') throw new Error('Kein 121-Spiel');
  return { gameId: c.gameId, settings: c.settings, order: game.order };
}

export type AnyGameState =
  | { mode: 'x01'; state: X01State }
  | { mode: 'cricket'; state: CricketState }
  | { mode: 'shanghai'; state: ShanghaiState }
  | { mode: 'doubles'; state: DoublesState }
  | { mode: 'countup'; state: CountUpState }
  | { mode: 'atc'; state: AtcState }
  | { mode: 'bobs'; state: BobsState }
  | { mode: 'halveit'; state: HalveItState }
  | { mode: 'one21'; state: One21State };

/** Spielstand eines beliebigen Spiels. */
export function computeGame(game: GameInfo, events: readonly AppEvent[]): AnyGameState {
  const evs = gameEventsOf(events, game.created.gameId);
  switch (game.created.mode) {
    case 'x01':
      return { mode: 'x01', state: computeX01(x01SetupOf(game), evs) };
    case 'cricket':
      return { mode: 'cricket', state: computeCricket(cricketSetupOf(game), evs) };
    case 'shanghai':
      return { mode: 'shanghai', state: computeShanghai(shanghaiSetupOf(game), evs) };
    case 'doubles':
      return { mode: 'doubles', state: computeDoubles(doublesSetupOf(game), evs) };
    case 'countup':
      return { mode: 'countup', state: computeCountUp(countUpSetupOf(game), evs) };
    case 'atc':
      return { mode: 'atc', state: computeAtc(atcSetupOf(game), evs) };
    case 'bobs':
      return { mode: 'bobs', state: computeBobs(bobsSetupOf(game), evs) };
    case 'halveit':
      return { mode: 'halveit', state: computeHalveIt(halveItSetupOf(game), evs) };
    case 'one21':
      return { mode: 'one21', state: computeOne21(one21SetupOf(game), evs) };
  }
}

/** Kurzer Titel, z. B. „501 · Double-Out“ oder „Cricket · Cut-Throat“. */
export function gameTitle(c: GameCreatedPayload): string {
  switch (c.mode) {
    case 'x01': {
      const out = { double: 'Double-Out', master: 'Master-Out', single: 'Single-Out' }[c.settings.outMode];
      return `${c.settings.startScore} · ${out}`;
    }
    case 'cricket':
      return c.settings.variant === 'cutthroat' ? 'Cricket · Cut-Throat' : 'Cricket';
    case 'shanghai':
      return 'Shanghai';
    case 'doubles':
      return 'Doppelfeld-Training';
    case 'countup':
      return `Count-Up · ${c.settings.rounds} Runden`;
    case 'atc':
      return `Around the Clock${atcVariantLabel(c.settings)}`;
    case 'bobs':
      return "Bob's 27";
    case 'halveit':
      return 'Halve-It';
    case 'one21':
      return '121';
  }
}
