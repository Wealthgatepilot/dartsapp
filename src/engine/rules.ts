// Regeltexte aus Bausteinen, passend zu den gewählten Einstellungen (SPEC 5.4).

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
