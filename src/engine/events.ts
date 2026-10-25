// Ereignisse, wie die Spiellogik sie sieht (SPEC Kapitel 3).
// Der Speicher ergänzt beim Ablegen deviceId, seq und v; die Spiellogik braucht nur id, type, ts und payload.

import type { AdviceLevel } from './checkout';
import type { CricketSettings } from './cricket';
import type { Field } from './types';
import type { X01Settings } from './x01';

type EventOf<T extends string, P> = { id: string; type: T; ts: number; payload: P };

/** Ein Ereignis ohne ID und Zeitstempel. Befehle der Spiellogik erzeugen nur solche. */
type NewOf<E> = E extends { type: infer T; payload: infer P } ? { type: T; payload: P } : never;

// ---------- Darts und Aufnahmen ----------

export interface DartPayload {
  gameId: string;
  slot: number;
  leg: number;
  set: number;
  turnIndex: number;
  dartIndex: number;
  field: Field | null;
  /** Bei Trainings mit Treffer/Falsch-Eingabe: Ziel getroffen? */
  hit?: boolean;
  input: 'board' | 'hitmiss' | 'bot' | 'auto';
  replaces?: string;
}

export interface ConfirmPayload {
  gameId: string;
  leg: number;
  slot: number;
  turnIndex: number;
}

export interface VoidPayload {
  gameId: string;
  targetId: string;
  reason: 'undo' | 'edit';
}

export type GameEvent =
  | EventOf<'dart.thrown', DartPayload>
  | EventOf<'turn.confirmed', ConfirmPayload>
  | EventOf<'event.voided', VoidPayload>;

export type NewEvent = NewOf<GameEvent>;

// ---------- Profile ----------

export type ProfileEvent =
  | EventOf<'profile.created', { profileId: string; name: string; color: string }>
  | EventOf<'profile.renamed', { profileId: string; name: string }>
  | EventOf<'profile.archived', { profileId: string }>
  | EventOf<'profile.restored', { profileId: string }>;

// ---------- Spiele ----------

export interface Participant {
  slot: number;
  kind: 'profile' | 'guest' | 'bot';
  profileId?: string;
  guestName?: string;
  botLevel?: number;
  /** Handicap (Phase 3). */
  startScore?: number;
}

interface GameCreatedBase {
  gameId: string;
  participants: Participant[];
  seed: number;
}

export type GameCreatedPayload =
  | (GameCreatedBase & { mode: 'x01'; settings: X01Settings; advice: AdviceLevel })
  | (GameCreatedBase & { mode: 'cricket'; settings: CricketSettings });

export type GameMode = GameCreatedPayload['mode'];

export type MatchEvent =
  | EventOf<'game.created', GameCreatedPayload>
  | EventOf<'game.orderDecided', { gameId: string; order: number[]; method: 'bull' | 'coin' | 'asEntered' }>
  | EventOf<'game.ended', { gameId: string; reason: 'finished' | 'abandoned' }>
  | EventOf<'game.hidden', { gameId: string }>;

/** Alle Ereignisse der App. */
export type AppEvent = GameEvent | ProfileEvent | MatchEvent;
export type NewAppEvent = NewOf<AppEvent>;

/** IDs aller widerrufenen Ereignisse. */
export function voidedIds(events: readonly { id: string; type: string; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const e of events) if (e.type === 'event.voided') ids.add((e.payload as VoidPayload).targetId);
  return ids;
}

/** Nur die Ereignisse, die die Spiellogik eines Spiels braucht. */
export function gameEventsOf(events: readonly AppEvent[], gameId: string): GameEvent[] {
  return events.filter(
    (e): e is GameEvent =>
      (e.type === 'dart.thrown' || e.type === 'turn.confirmed' || e.type === 'event.voided') &&
      e.payload.gameId === gameId,
  );
}
