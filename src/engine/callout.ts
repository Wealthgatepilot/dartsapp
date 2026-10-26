// Ansagetexte für die Sprachausgabe (SPEC 10): was nach „Weiter“ bzw. am Spielende gesagt wird.
// Reine Logik; das Vorlesen übernimmt die Oberfläche. Zahlen bleiben Ziffern – die deutsche Stimme liest
// „140“ als „hundertvierzig“.

import type { AtcTurn } from './atc';
import type { BobsTurn } from './bobs';
import type { CountUpTurn } from './countup';
import type { CricketTurn } from './cricket';
import type { DoublesTurn } from './doubles';
import type { FinishTurn } from './finish';
import type { AnyGameState } from './games';
import type { HalveItTurn } from './halveit';
import type { KillerTurn } from './killer';
import type { One21Turn } from './one21';
import type { ShanghaiTurn } from './shanghai';
import type { Turn as X01Turn } from './x01';

/** Reste, die mit 3 Darts nicht checkbar sind (Double-Out). */
const BOGEY = new Set([169, 168, 166, 165, 163, 162, 159]);
const onFinish = (rest: number) => rest >= 2 && rest <= 170 && !BOGEY.has(rest);

/** Wer nach dem Werfer im laufenden Leg dran ist. */
function nextSlot(g: AnyGameState, slot: number): number {
  const order = g.state.legs[g.state.legs.length - 1].order;
  return order[(order.indexOf(slot) + 1) % order.length];
}

const turnPoints = (t: { darts: { scored: number }[] }) => t.darts.reduce((n, d) => n + d.scored, 0);

/**
 * Ansage für eine Aufnahme, die gerade mit „Weiter“ bestätigt wird (`turn` = die Aufnahme vor dem Bestätigen).
 * null = nichts sagen.
 */
export function turnCallout(g: AnyGameState, turn: unknown, nameOf: (slot: number) => string): string | null {
  switch (g.mode) {
    case 'x01': {
      const t = turn as X01Turn;
      if (t.checkout) return 'Game Shot';
      const parts = [t.bust ? 'Bust' : String(t.startRemaining - t.endRemaining)];
      // Wie ein Schreiber: dem Nächsten sagen, was er braucht, wenn er auf einem Finish steht
      if (g.state.order.length > 1) {
        const next = nextSlot(g, t.slot);
        const rest = g.state.remaining[next];
        if (g.state.isIn[next] && onFinish(rest)) parts.push(`${nameOf(next)}, du brauchst ${rest}`);
      } else if (onFinish(t.endRemaining)) {
        parts.push(`Du brauchst ${t.endRemaining}`);
      }
      return parts.join('. ');
    }
    case 'cricket': {
      const t = turn as CricketTurn;
      return t.marks === 0 ? 'Keine Marks' : t.marks === 1 ? 'Ein Mark' : `${t.marks} Marks`;
    }
    case 'shanghai': {
      const t = turn as ShanghaiTurn;
      return t.shanghai ? 'Shanghai' : String(t.points);
    }
    case 'countup':
      return String((turn as CountUpTurn).points);
    case 'atc': {
      const t = turn as AtcTurn;
      const target = g.state.targetOf(t.slot);
      const hits = t.hits === 0 ? 'Kein Treffer' : t.hits === 1 ? 'Ein Treffer' : `${t.hits} Treffer`;
      return target === null ? hits : `${hits}. Nächstes Ziel ${target === 25 ? 'Bull' : target}`;
    }
    case 'halveit': {
      const t = turn as HalveItTurn;
      return t.halved ? 'Halbiert' : String(t.points);
    }
    case 'bobs': {
      const t = turn as BobsTurn;
      return t.change >= 0 ? `Plus ${t.change}` : `Minus ${-t.change}`;
    }
    case 'doubles': {
      const t = turn as DoublesTurn;
      return t.hits === 0 ? 'Kein Treffer' : t.hits === 1 ? 'Ein Treffer' : `${t.hits} Treffer`;
    }
    case 'killer': {
      const t = turn as KillerTurn;
      const out = t.effects.filter((e) => e.kind === 'out').map((e) => `${nameOf(e.slot)} ist raus`);
      if (out.length) return out.join('. ');
      if (t.effects.some((e) => e.kind === 'killer')) return `${nameOf(t.slot)} ist Killer`;
      const lives = t.effects.filter((e) => e.kind === 'life').length;
      return lives ? `${lives === 1 ? 'Ein Leben' : `${lives} Leben`} genommen` : null;
    }
    case 'one21':
    case 'finish': {
      const t = turn as One21Turn | FinishTurn;
      if (t.checkout) return 'Geschafft';
      if (t.bust) return 'Bust';
      return 'failed' in t && t.failed ? 'Nicht geschafft' : String(turnPoints(t));
    }
  }
}

/** Ansage am Spielende. */
export function matchCallout(g: AnyGameState, nameOf: (slot: number) => string): string | null {
  const w = g.state.matchWinners;
  if (!w || !w.length) return null;
  const names = w.map(nameOf).join(' und ');
  if (g.mode === 'x01') return `Game Shot und das Match. ${names} gewinnt`;
  return w.length === 1 ? `${names} gewinnt` : `Gleichstand: ${names}`;
}
