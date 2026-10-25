// Spiele aus Ereignissen: Liste, Reihenfolge, laufendes Spiel (SPEC 5).

import { computeCricket, type CricketSetup, type CricketState } from './cricket';
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

export type AnyGameState =
  | { mode: 'x01'; state: X01State }
  | { mode: 'cricket'; state: CricketState }
  | { mode: 'shanghai'; state: ShanghaiState }
  | { mode: 'doubles'; state: DoublesState };

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
  }
}
