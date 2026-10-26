// Favoriten je Profil (Wunsch Gianluca): das letzte Ereignis zählt.

import { describe, expect, it } from 'vitest';
import type { AppEvent, NewAppEvent } from '../../src/engine/events';
import { favoritesOf, toggleFavorite } from '../../src/engine/favorites';

let n = 0;
const ev = (e: NewAppEvent): AppEvent => ({ ...e, id: `f${++n}`, ts: n }) as AppEvent;

describe('Favoriten', () => {
  it('setzen, zurücknehmen, je Profil getrennt', () => {
    const events: AppEvent[] = [];
    events.push(ev(toggleFavorite(favoritesOf(events), 'g1', 'gian')));
    events.push(ev(toggleFavorite(favoritesOf(events), 'g1', 'joern')));
    expect([...favoritesOf(events).get('g1')!].sort()).toEqual(['gian', 'joern']);
    events.push(ev(toggleFavorite(favoritesOf(events), 'g1', 'gian')));
    expect([...favoritesOf(events).get('g1')!]).toEqual(['joern']);
    expect(favoritesOf(events).get('g2')).toBeUndefined();
  });
});
