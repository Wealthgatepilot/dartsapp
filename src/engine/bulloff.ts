// Wer beginnt: Ausbullen und Münzwurf (SPEC 6.3 und 6.4). Reine Rechenregeln, ohne Oberfläche.

import { voidedIds, type GameEvent } from './events';

/** Radien in mm (SPEC Kapitel 1). */
export const BULLSEYE_R = 6.35;
export const SINGLE_BULL_R = 15.9;

/** Abstand zum Mittelpunkt in mm, auf eine Nachkommastelle gerundet (SPEC 6.4, Punkt 4). */
export function distanceMm(xMm: number, yMm: number): number {
  return Math.round(Math.hypot(xMm, yMm) * 10) / 10;
}

/** Anzeige des Ergebnisses: „Bullseye · 3,2 mm“, „Single-Bull · 12,0 mm“ oder „19,9 mm vom Bull“. */
export function distanceLabel(d: number): string {
  const mm = d.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (d <= BULLSEYE_R) return `Bullseye · ${mm} mm`;
  if (d <= SINGLE_BULL_R) return `Single-Bull · ${mm} mm`;
  return `${mm} mm vom Bull`;
}

export interface BullThrow {
  id: string;
  slot: number;
  attempt: number;
  xMm: number;
  yMm: number;
  distanceMm: number;
}

export interface BulloffState {
  /** Alle gültigen Würfe. */
  throws: BullThrow[];
  /** Wer als Nächstes werfen muss, und in welchem Durchgang. null = Reihenfolge steht fest. */
  next: { slot: number; attempt: number } | null;
  /** Gruppen, die gerade neu werfen müssen, weil sie exakt gleich weit lagen. */
  rethrow: number[][];
  /** Feste Reihenfolge, sobald alle Gleichstände aufgelöst sind. */
  order: number[] | null;
}

/**
 * Rangfolge nach SPEC 6.4: Durchgang 1 werfen alle in Setup-Reihenfolge. Dann aufsteigender Abstand.
 * Liegen mehrere exakt gleich (auf 0,1 mm), werfen nur diese erneut (nächster Durchgang), um ihre Plätze untereinander.
 */
export function computeBulloff(slots: readonly number[], gameId: string, events: readonly GameEvent[]): BulloffState {
  const voided = voidedIds(events);
  const byKey = new Map<string, BullThrow>();
  for (const e of events) {
    if (e.type !== 'bulloff.throw' || voided.has(e.id) || e.payload.gameId !== gameId) continue;
    const p = e.payload;
    byKey.set(`${p.slot}|${p.attempt}`, { id: e.id, ...p });
  }
  const get = (slot: number, attempt: number) => byKey.get(`${slot}|${attempt}`);

  let next: BulloffState['next'] = null;
  const rethrow: number[][] = [];

  /** Ordnet eine Gruppe; liefert null, solange Würfe fehlen. */
  const rank = (group: number[], attempt: number): number[] | null => {
    const missing = group.find((s) => !get(s, attempt));
    if (missing !== undefined) {
      next ??= { slot: missing, attempt };
      if (attempt > 1) rethrow.push(group);
      return null;
    }
    const sorted = [...group].sort((a, b) => get(a, attempt)!.distanceMm - get(b, attempt)!.distanceMm);
    const result: number[] = [];
    let complete = true;
    for (let i = 0; i < sorted.length; ) {
      const d = get(sorted[i], attempt)!.distanceMm;
      const same = sorted.filter((s) => get(s, attempt)!.distanceMm === d);
      if (same.length === 1) result.push(sorted[i]);
      else {
        const sub = rank(same, attempt + 1);
        if (sub) result.push(...sub);
        else complete = false;
      }
      i += same.length;
    }
    return complete ? result : null;
  };

  const order = slots.length > 1 ? rank([...slots], 1) : [...slots];
  const throws = [...byKey.values()].sort((a, b) => a.attempt - b.attempt);
  return { throws, next, rethrow, order };
}

/** Münzwurf (SPEC 6.3): zufällige Reihenfolge aller Spieler; `random` liefert Zahlen in [0, 1). */
export function coinOrder(slots: readonly number[], random: () => number): number[] {
  const list = [...slots];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Zufall aus dem Betriebssystem (crypto.getRandomValues), wie in SPEC 6.3 verlangt. */
export function cryptoRandom(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}
