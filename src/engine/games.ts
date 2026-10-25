// Spiele aus Ereignissen: Liste, Reihenfolge, laufendes Spiel (SPEC 5).

import type { AppEvent, GameCreatedPayload } from './events';
import type { X01Setup } from './x01';

export interface GameInfo {
  created: GameCreatedPayload;
  createdAt: number;
  order: number[];
  ended: 'finished' | 'abandoned' | null;
  hidden: boolean;
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
        });
      }
      continue;
    }
    const g =
      e.type === 'game.orderDecided' || e.type === 'game.ended' || e.type === 'game.hidden'
        ? games.get(e.payload.gameId)
        : undefined;
    if (!g) continue;
    if (e.type === 'game.orderDecided') g.order = e.payload.order;
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
  const startScores: Record<number, number> = {};
  for (const p of game.created.participants) if (p.startScore) startScores[p.slot] = p.startScore;
  return {
    gameId: game.created.gameId,
    settings: game.created.settings,
    order: game.order,
    ...(Object.keys(startScores).length ? { startScores } : {}),
  };
}
