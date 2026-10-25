// Regeltexte aus Bausteinen, passend zu den gewählten Einstellungen (SPEC 5.4).

import type { CricketSettings } from './cricket';
import { winsNeeded, type InOut, type Race, type X01Settings } from './x01';

const IN_TEXT: Record<InOut, string> = {
  single: 'Jeder Treffer zählt sofort.',
  double:
    'Double-In: Deine Punkte zählen erst, wenn du ein Double triffst (auch das Bullseye zählt als Double). Das Double selbst zählt schon.',
  master:
    'Master-In: Deine Punkte zählen erst, wenn du ein Double oder Triple triffst (auch das Bullseye). Dieser Dart zählt schon.',
};

const OUT_TEXT: Record<InOut, string> = {
  single: 'Single-Out: Du musst genau auf 0 kommen, mit einem beliebigen Feld.',
  double: 'Double-Out: Du musst genau auf 0 kommen, und der letzte Dart muss ein Double sein. Das Bullseye (50) zählt als Double.',
  master: 'Master-Out: Du musst genau auf 0 kommen, und der letzte Dart muss ein Double oder Triple sein. Das Bullseye zählt als Double.',
};

const BUST_TEXT: Record<InOut, string> = {
  single: 'Überwirfst du (unter 0), ist die Aufnahme ungültig („Bust“): Dein Rest springt auf den Stand vor der Aufnahme zurück.',
  double:
    'Überwirfst du (unter 0), bleibt genau 1 übrig oder kommst du ohne Double auf 0, ist die Aufnahme ungültig („Bust“): Dein Rest springt auf den Stand vor der Aufnahme zurück, die restlichen Darts verfallen.',
  master:
    'Überwirfst du (unter 0), bleibt genau 1 übrig oder kommst du ohne Double oder Triple auf 0, ist die Aufnahme ungültig („Bust“): Dein Rest springt auf den Stand vor der Aufnahme zurück, die restlichen Darts verfallen.',
};

function raceText(r: Race, unit: [string, string]): string {
  const need = winsNeeded(r);
  const word = need === 1 ? unit[0] : unit[1];
  return r.kind === 'firstTo'
    ? `Wer zuerst ${need} ${word} gewinnt`
    : `Best of ${r.count}: Wer zuerst ${need} ${word} gewinnt`;
}

function matchText(legs: Race, sets: Race | null): string[] {
  if (sets) {
    return [`${raceText(legs, ['Leg', 'Legs'])}, gewinnt ein Set. ${raceText(sets, ['Set', 'Sets'])}, gewinnt das Spiel.`];
  }
  if (winsNeeded(legs) === 1) return [];
  return [`${raceText(legs, ['Leg', 'Legs'])}, gewinnt das Spiel. Der Anwurf wechselt von Leg zu Leg.`];
}

const targetName = (n: number) => (n === 25 ? 'Bull' : String(n));

export function cricketRules(s: CricketSettings): string[] {
  const names = s.targets.map(targetName);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}` : names[0];
  const times = s.closeAt === 1 ? 'einmal' : `${s.closeAt}-mal`;
  const out = [
    `Gespielt wird auf ${list}. Treffer auf andere Zahlen zählen nichts.`,
    `Eine Zahl ist bei dir zu, wenn du sie ${times} getroffen hast. Ein Single zählt 1 Treffer, ein Double 2, ein Triple 3. Beim Bull zählt das Single-Bull 1, das Bullseye 2.`,
  ];
  if (s.variant === 'standard') {
    out.push(
      'Triffst du eine Zahl, die bei dir schon zu ist, bekommst du ihren Wert als Punkte (Bull 25) – aber nur, solange mindestens ein Gegner sie noch offen hat.',
      'Gewonnen hat, wer alle Zahlen zu hat und mindestens so viele Punkte hat wie jeder Gegner. Liegst du hinten, punktest du weiter.',
    );
  } else {
    out.push(
      'Cut-Throat: Triffst du eine Zahl, die bei dir schon zu ist, bekommen alle Gegner, die sie noch offen haben, ihren Wert als Punkte (Bull 25). Punkte sind hier schlecht.',
      'Gewonnen hat, wer alle Zahlen zu hat und höchstens so viele Punkte hat wie jeder Gegner.',
    );
  }
  return [...out, ...matchText(s.legs, s.sets)];
}

export function x01Rules(s: X01Settings): string[] {
  const out = [
    `Jeder Spieler startet mit ${s.startScore} Punkten und wirft pro Aufnahme 3 Darts. Die Punkte werden abgezogen.`,
    IN_TEXT[s.inMode],
    OUT_TEXT[s.outMode],
    BUST_TEXT[s.outMode],
  ];
  if (s.sets) {
    out.push(
      `${raceText(s.legs, ['Leg', 'Legs'])}, gewinnt ein Set. ${raceText(s.sets, ['Set', 'Sets'])}, gewinnt das Spiel.`,
    );
  } else {
    out.push(`${raceText(s.legs, ['Leg', 'Legs'])}, gewinnt das Spiel.`);
  }
  out.push('Der Anwurf wechselt von Leg zu Leg.');
  return out;
}
