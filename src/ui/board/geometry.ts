// Reine Rechenfunktionen der Board-Eingabe (SPEC 4.2 und 4.3), ohne Bildschirmzugriff,
// damit sie sich mit Tests prüfen lassen.

import { BOARD_ORDER } from '../../engine/types';

/** Zonen als Anteil am Radius des gezeichneten Boards. */
export const BULL_ZONE = 0.16;
export const NUMBER_ZONE = 0.84;

export type Zone =
  | { kind: 'bull' }
  | { kind: 'number'; n: number }
  | { kind: 'miss' }
  | { kind: 'outside' };

/**
 * Welche Zone liegt an dieser Stelle?
 * dx, dy: Abstand vom Board-Mittelpunkt in Pixeln (dy wächst nach unten), radius: Board-Radius in Pixeln.
 */
export function zoneAt(dx: number, dy: number, radius: number): Zone {
  const r = Math.hypot(dx, dy) / radius;
  if (r > 1) return { kind: 'outside' };
  if (r > NUMBER_ZONE) return { kind: 'miss' };
  if (r <= BULL_ZONE) return { kind: 'bull' };
  return { kind: 'number', n: numberAtAngle(dx, dy) };
}

/** Zahl in Richtung (dx, dy). Die 20 liegt oben, jedes Stück ist 18° breit. */
export function numberAtAngle(dx: number, dy: number): number {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0° = oben, im Uhrzeigersinn
  const normalized = (deg + 360 + 9) % 360;
  return BOARD_ORDER[Math.floor(normalized / 18) % 20];
}

/** Mittelwinkel einer Zahl in Grad (0° = oben, im Uhrzeigersinn). */
export function angleOfNumber(n: number): number {
  return BOARD_ORDER.indexOf(n as (typeof BOARD_ORDER)[number]) * 18;
}

// ---------- Ring-Leiste ----------

export type BarDirection = 'up' | 'left' | 'right';

export interface BarLayout {
  direction: BarDirection;
  /** Linke obere Ecke und Größe der Leiste in Bildschirm-Pixeln. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BarSizes {
  /** Größe eines Felds der Leiste (Breite und Höhe). */
  item: number;
  /** Abstand zwischen Fingerkuppe und dem nächsten Feld. */
  gap: number;
  /** Mindestabstand zum Bildschirmrand. */
  margin: number;
}

// 3 × 48 = 144 Pixel: passt auch auf einem 375 Pixel breiten Handy noch seitlich neben die Mitte.
export const DEFAULT_BAR: BarSizes = { item: 48, gap: 32, margin: 8 };

/**
 * Wo erscheint die Ring-Leiste? Bevorzugt oberhalb des Fingers, sonst seitlich
 * (links oder rechts, wo mehr Platz ist). Nie unter dem Finger.
 */
export function placeBar(
  touchX: number,
  touchY: number,
  items: number,
  viewportWidth: number,
  viewportHeight: number,
  sizes: BarSizes = DEFAULT_BAR,
): BarLayout {
  const length = items * sizes.item;
  const clampX = (x: number, w: number) =>
    Math.min(Math.max(x, sizes.margin), viewportWidth - sizes.margin - w);
  const clampY = (y: number, h: number) =>
    Math.min(Math.max(y, sizes.margin), viewportHeight - sizes.margin - h);

  const top = touchY - sizes.gap - length;
  if (top >= sizes.margin) {
    return {
      direction: 'up',
      x: clampX(touchX - sizes.item / 2, sizes.item),
      y: top,
      width: sizes.item,
      height: length,
    };
  }

  const spaceLeft = touchX - sizes.gap - sizes.margin;
  const spaceRight = viewportWidth - touchX - sizes.gap - sizes.margin;
  const y = clampY(touchY - sizes.item / 2, sizes.item);
  if (spaceRight >= spaceLeft) {
    return { direction: 'right', x: touchX + sizes.gap, y, width: length, height: sizes.item };
  }
  return { direction: 'left', x: touchX - sizes.gap - length, y, width: length, height: sizes.item };
}

/**
 * Wie weit wurde der Finger in Richtung der Leiste gezogen? (Pixel, negativ = Gegenrichtung)
 */
export function dragTowardsBar(direction: BarDirection, moveX: number, moveY: number): number {
  switch (direction) {
    case 'up':
      return -moveY;
    case 'left':
      return -moveX;
    case 'right':
      return moveX;
  }
}

export const CANCEL_DISTANCE = 60;

/**
 * Gewählte Stufe aus der Zugweite: 0 = erstes Feld (S bzw. 25), 1 = zweites (D bzw. 50), 2 = drittes (T).
 * -1 = abgebrochen (weit in die Gegenrichtung gezogen).
 */
export function stepFromDrag(distance: number, items: number, stepPx: number): number {
  if (distance < -CANCEL_DISTANCE) return -1;
  if (distance < stepPx) return 0;
  return Math.min(Math.floor(distance / stepPx), items - 1);
}
