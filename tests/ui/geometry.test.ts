import { describe, expect, it } from 'vitest';
import {
  BULL_ZONE,
  NUMBER_ZONE,
  dragTowardsBar,
  numberAtAngle,
  placeBar,
  stepFromDrag,
  zoneAt,
} from '../../src/ui/board/geometry';
import { BOARD_ORDER } from '../../src/engine/types';

const R = 100;

describe('zoneAt', () => {
  it('Mittelpunkt ist Bull', () => {
    expect(zoneAt(0, 0, R)).toEqual({ kind: 'bull' });
    expect(zoneAt(0, -BULL_ZONE * R, R)).toEqual({ kind: 'bull' });
  });

  it('Himmelsrichtungen: 20 oben, 6 rechts, 3 unten, 11 links', () => {
    expect(zoneAt(0, -50, R)).toEqual({ kind: 'number', n: 20 });
    expect(zoneAt(50, 0, R)).toEqual({ kind: 'number', n: 6 });
    expect(zoneAt(0, 50, R)).toEqual({ kind: 'number', n: 3 });
    expect(zoneAt(-50, 0, R)).toEqual({ kind: 'number', n: 11 });
  });

  it('Zahlenring außen ist Daneben, außerhalb des Boards nichts', () => {
    expect(zoneAt(0, -(NUMBER_ZONE * R + 1), R)).toEqual({ kind: 'miss' });
    expect(zoneAt(0, -R, R)).toEqual({ kind: 'miss' });
    expect(zoneAt(0, -(R + 1), R)).toEqual({ kind: 'outside' });
  });
});

describe('numberAtAngle', () => {
  it('trifft jede Zahl in der Mitte ihres Stücks', () => {
    BOARD_ORDER.forEach((n, i) => {
      const rad = (i * 18 * Math.PI) / 180;
      expect(numberAtAngle(Math.sin(rad), -Math.cos(rad))).toBe(n);
    });
  });

  it('Grenze zwischen 20 und 1 liegt bei 9°', () => {
    const at = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return numberAtAngle(Math.sin(rad), -Math.cos(rad));
    };
    expect(at(8.9)).toBe(20);
    expect(at(9.1)).toBe(1);
    expect(at(-8.9)).toBe(20);
    expect(at(-9.1)).toBe(5);
  });
});

describe('placeBar', () => {
  it('liegt oberhalb des Fingers, wenn Platz ist', () => {
    const bar = placeBar(200, 600, 3, 400, 800);
    expect(bar.direction).toBe('up');
    expect(bar.y + bar.height).toBeLessThan(600);
  });

  it('weicht zur Seite mit mehr Platz aus, wenn oben kein Platz ist', () => {
    const right = placeBar(100, 60, 3, 400, 800);
    expect(right.direction).toBe('right');
    expect(right.x).toBeGreaterThan(100);
    const left = placeBar(300, 60, 3, 400, 800);
    expect(left.direction).toBe('left');
    expect(left.x + left.width).toBeLessThan(300);
  });

  it('liegt nie unter dem Fingerpunkt', () => {
    for (let y = 0; y <= 800; y += 20) {
      for (let x = 0; x <= 400; x += 20) {
        const b = placeBar(x, y, 3, 400, 800);
        const covers = x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
        expect(covers).toBe(false);
      }
    }
  });
});

describe('Stufenwahl durch Ziehen', () => {
  it('Richtung der Leiste zählt positiv', () => {
    expect(dragTowardsBar('up', 0, -50)).toBe(50);
    expect(dragTowardsBar('left', -50, 0)).toBe(50);
    expect(dragTowardsBar('right', 50, 0)).toBe(50);
  });

  it('S, D, T alle 40 Pixel', () => {
    expect(stepFromDrag(0, 3, 40)).toBe(0);
    expect(stepFromDrag(39, 3, 40)).toBe(0);
    expect(stepFromDrag(40, 3, 40)).toBe(1);
    expect(stepFromDrag(79, 3, 40)).toBe(1);
    expect(stepFromDrag(80, 3, 40)).toBe(2);
    expect(stepFromDrag(400, 3, 40)).toBe(2);
  });

  it('Bull hat nur zwei Stufen', () => {
    expect(stepFromDrag(200, 2, 40)).toBe(1);
  });

  it('kleine Bewegung in Gegenrichtung bleibt Single, große bricht ab', () => {
    expect(stepFromDrag(-30, 3, 40)).toBe(0);
    expect(stepFromDrag(-61, 3, 40)).toBe(-1);
  });
});
