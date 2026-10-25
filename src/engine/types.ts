// Grundbegriffe aus SPEC Kapitel 1 und 3.4.

/** Zahl auf dem Board: 1–20 oder 25 (Bull). */
export type FieldNumber = number;

/** Multiplikator: 0 = daneben, 1 = Single, 2 = Double, 3 = Triple. */
export type Multiplier = 0 | 1 | 2 | 3;

/** Wo ein Dart steckt. Daneben: { n: 0, m: 0 }. */
export interface Field {
  n: FieldNumber;
  m: Multiplier;
}

export const BULL = 25;
export const MISS: Field = { n: 0, m: 0 };

/** Zahlen im Uhrzeigersinn, oben beginnend. */
export const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;

export function points(f: Field): number {
  return f.n * f.m;
}

export function isDouble(f: Field): boolean {
  return f.m === 2;
}

export function isValidField(f: Field): boolean {
  if (f.m === 0) return f.n === 0;
  if (f.n === BULL) return f.m === 1 || f.m === 2;
  return Number.isInteger(f.n) && f.n >= 1 && f.n <= 20;
}

/** Liest die Kurzschreibweise (S20, D16, T19, SB, DB, 0). Wirft bei ungültiger Eingabe. */
export function parseField(text: string): Field {
  const t = text.trim().toUpperCase();
  if (t === '0') return MISS;
  if (t === 'SB') return { n: BULL, m: 1 };
  if (t === 'DB') return { n: BULL, m: 2 };
  const match = /^([SDT])(\d{1,2})$/.exec(t);
  const f: Field | null = match ? { n: Number(match[2]), m: ('SDT'.indexOf(match[1]) + 1) as Multiplier } : null;
  if (!f || !isValidField(f)) throw new Error(`Ungültiges Feld: ${text}`);
  return f;
}

/** Kurzschreibweise: S20, D16, T19, SB, DB, 0. */
export function fieldLabel(f: Field): string {
  if (f.m === 0) return '0';
  if (f.n === BULL) return f.m === 2 ? 'DB' : 'SB';
  return `${'SDT'[f.m - 1]}${f.n}`;
}
