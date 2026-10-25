// Ereignisse, wie die Spiellogik sie sieht (SPEC Kapitel 3).
// Der Speicher ergänzt beim Ablegen deviceId, seq und v; die Spiellogik braucht nur id, type und payload.

import type { Field } from './types';

export interface DartPayload {
  gameId: string;
  slot: number;
  leg: number;
  set: number;
  turnIndex: number;
  dartIndex: number;
  field: Field | null;
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
  targetId: string;
  reason: 'undo' | 'edit';
}

export type GameEvent =
  | { id: string; type: 'dart.thrown'; ts: number; payload: DartPayload }
  | { id: string; type: 'turn.confirmed'; ts: number; payload: ConfirmPayload }
  | { id: string; type: 'event.voided'; ts: number; payload: VoidPayload };

/** Ein Ereignis, das noch keine ID und keinen Zeitstempel hat. Die Spiellogik erzeugt nur solche. */
export type NewEvent =
  | { type: 'dart.thrown'; payload: DartPayload }
  | { type: 'turn.confirmed'; payload: ConfirmPayload }
  | { type: 'event.voided'; payload: VoidPayload };

/** IDs aller widerrufenen Ereignisse. */
export function voidedIds(events: readonly GameEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const e of events) if (e.type === 'event.voided') ids.add(e.payload.targetId);
  return ids;
}
