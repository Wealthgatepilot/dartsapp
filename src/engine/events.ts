// Ereignisse, wie die Spiellogik sie sieht (SPEC Kapitel 3).
// Der Speicher ergänzt beim Ablegen deviceId, seq und v; die Spiellogik braucht nur id, type, ts und payload.

import type { AtcSettings } from './atc';
import type { BobsSettings } from './bobs';
import type { AdviceLevel } from './checkout';
import type { CountUpSettings } from './countup';
import type { CricketSettings } from './cricket';
import type { DoublesSettings } from './doubles';
import type { FinishSettings } from './finish';
import type { HalveItSettings } from './halveit';
import type { KillerSettings } from './killer';
import type { One21Settings } from './one21';
import type { ShanghaiSettings } from './shanghai';
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
  /** Bei Trainings: Zielfeld zum Zeitpunkt des Wurfs (zur Information; maßgeblich ist die berechnete Folge). */
  target?: Field;
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

/** Antwort auf eine Frage im Spiel, z. B. „Spiel beenden?“ nach einem Shanghai (SPEC 7.3). */
export type DecisionPayload = { gameId: string; slot: number; turnIndex: number } & (
  | { kind: 'shanghai'; end: boolean }
  /** 121: aktuelle Zahl überspringen (zählt als nicht geschafft), vor der Aufnahme turnIndex. */
  | { kind: 'skip' }
);

/** Ein Ausbullen-Dart: angetippte Stelle in mm vom Mittelpunkt (x nach rechts, y nach unten), SPEC 6.4. */
export interface BullThrowPayload {
  gameId: string;
  slot: number;
  attempt: number;
  xMm: number;
  yMm: number;
  distanceMm: number;
}

export type GameEvent =
  | EventOf<'dart.thrown', DartPayload>
  | EventOf<'turn.confirmed', ConfirmPayload>
  | EventOf<'event.voided', VoidPayload>
  | EventOf<'game.decision', DecisionPayload>
  | EventOf<'bulloff.throw', BullThrowPayload>;

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
  /** Computer mit menschlichen Schwankungen (Tagesform, Streaks, Druck); fehlt = an. */
  botHuman?: boolean;
  /** Handicap (Phase 3). */
  startScore?: number;
}

/** Wie die Reihenfolge festgelegt wird (SPEC 6.3). Fehlt die Angabe (ältere Spiele): wie eingetragen. */
export type StartMethod = 'bull' | 'coin' | 'asEntered';

interface GameCreatedBase {
  gameId: string;
  participants: Participant[];
  seed: number;
  start?: StartMethod;
}

export type GameCreatedPayload =
  | (GameCreatedBase & { mode: 'x01'; settings: X01Settings; advice: AdviceLevel })
  | (GameCreatedBase & { mode: 'cricket'; settings: CricketSettings })
  | (GameCreatedBase & { mode: 'shanghai'; settings: ShanghaiSettings })
  | (GameCreatedBase & { mode: 'doubles'; settings: DoublesSettings })
  | (GameCreatedBase & { mode: 'countup'; settings: CountUpSettings })
  | (GameCreatedBase & { mode: 'atc'; settings: AtcSettings })
  | (GameCreatedBase & { mode: 'bobs'; settings: BobsSettings })
  | (GameCreatedBase & { mode: 'halveit'; settings: HalveItSettings })
  | (GameCreatedBase & { mode: 'one21'; settings: One21Settings })
  | (GameCreatedBase & { mode: 'killer'; settings: KillerSettings })
  /** 121 in der neuen Form (zufällige Finishes); 'one21' ist die alte Form, nur noch zum Lesen. */
  | (GameCreatedBase & { mode: 'finish'; settings: FinishSettings });

export type GameMode = GameCreatedPayload['mode'];

export type MatchEvent =
  | EventOf<'game.created', GameCreatedPayload>
  | EventOf<'game.orderDecided', { gameId: string; order: number[]; method: 'bull' | 'coin' | 'asEntered' }>
  | EventOf<'game.ended', { gameId: string; reason: 'finished' | 'abandoned' }>
  | EventOf<'game.hidden', { gameId: string }>
  /** Ein Profil markiert ein Spiel als Favorit (bzw. nimmt die Markierung zurück); das letzte Ereignis zählt. */
  | EventOf<'game.favorite', { gameId: string; profileId: string; favorite: boolean }>;

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
      (e.type === 'dart.thrown' ||
        e.type === 'turn.confirmed' ||
        e.type === 'event.voided' ||
        e.type === 'game.decision' ||
        e.type === 'bulloff.throw') &&
      e.payload.gameId === gameId,
  );
}
