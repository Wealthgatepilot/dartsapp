// Favoriten (Wunsch Gianluca, 26.10.2026): Profile markieren Spiele, die sie gut fanden, um sie später
// wieder anzusehen. Jedes Setzen und Zurücknehmen ist ein eigenes Ereignis; es zählt das jeweils letzte.

import type { AppEvent, NewAppEvent } from './events';

/** Spiel → Profile, die es als Favorit markiert haben. */
export function favoritesOf(events: readonly AppEvent[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.type !== 'game.favorite') continue;
    const set = map.get(e.payload.gameId) ?? new Set<string>();
    if (e.payload.favorite) set.add(e.payload.profileId);
    else set.delete(e.payload.profileId);
    map.set(e.payload.gameId, set);
  }
  return map;
}

/** Ereignis zum Umschalten des Favoriten eines Profils für ein Spiel. */
export function toggleFavorite(favorites: Map<string, Set<string>>, gameId: string, profileId: string): NewAppEvent {
  const on = favorites.get(gameId)?.has(profileId) ?? false;
  return { type: 'game.favorite', payload: { gameId, profileId, favorite: !on } };
}
