// Regeltexte aus Bausteinen, passend zu den gewählten Einstellungen (SPEC 5.4).

import type { CricketSettings } from './cricket';
import { targetsOf, type DoublesSettings } from './doubles';
import { halveTargetName, type HalveItSettings } from './halveit';
import type { One21Settings } from './one21';
import type { AtcSettings } from './atc';
import type { BobsSettings } from './bobs';
import type { CountUpSettings } from './countup';
import { targetOfRound, type ShanghaiSettings } from './shanghai';
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

export function shanghaiRules(s: ShanghaiSettings): string[] {
  const first = targetName(targetOfRound(s, 1));
  const last = targetName(targetOfRound(s, s.rounds));
  const withBull = targetOfRound(s, s.rounds) === 25;
  const out = [
    s.rounds === 1
      ? `Gespielt wird 1 Runde mit dem Ziel ${first}.`
      : `Gespielt werden ${s.rounds} Runden. Runde 1 hat das Ziel ${first}, danach geht es aufwärts bis ${last}.`,
    'Pro Runde wirft jeder 3 Darts auf das Ziel. Es zählt die Zahl mal Ring (Double doppelt, Triple dreifach), beim Bull 25 bzw. 50. Andere Felder zählen nichts.',
    `Shanghai heißt: Single, Double und Triple des Ziels in einer Aufnahme. Nach einem Shanghai fragt die App, ob das Spiel endet (dann gewinnt der Werfer sofort) oder weitergespielt wird. Vorausgewählt ist „${
      s.endOnShanghai ? 'Spiel beenden' : 'Weiterspielen'
    }“.${withBull ? ' Beim Bull ist kein Shanghai möglich.' : ''}`,
    'Nach der letzten Runde gewinnt, wer die meisten Punkte hat. Bei Gleichstand teilen sich die Spieler den Sieg.',
  ];
  return out;
}

function doublesTargetText(s: DoublesSettings): string {
  const t = targetsOf(s);
  const bull = t.some((f) => f.n === 25) ? ' Beim Bull zählt nur das Bullseye.' : '';
  if (t.length === 21) return `Ziele sind D1 bis D20 und das Bullseye, in zufälliger Reihenfolge.${bull}`;
  const names = t.map((f) => (f.n === 25 ? 'Bullseye' : `D${f.n}`));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}` : names[0];
  return `Ziele sind ${list}${names.length > 1 ? ', in zufälliger Reihenfolge' : ''}.${bull}`;
}

export function doublesRules(s: DoublesSettings): string[] {
  const out = [
    doublesTargetText(s),
    s.sequence === 'shared' ? 'Alle spielen dieselbe Zielfolge.' : 'Jeder bekommt seine eigene Zielfolge.',
    'Nach jedem Dart tippst du „Treffer“ oder „Falsch“.',
  ];
  if (s.mode.kind === 'untilHit') {
    out.push(
      'Ein Ziel bleibt, bis du es triffst. Dann kommt sofort das nächste, auch mitten in der Aufnahme.',
      `Fertig ist, wer alle ${targetsOf(s).length} Ziele getroffen hat. Es gewinnt, wer dafür die wenigsten Darts braucht.`,
    );
  } else {
    const n = s.mode.darts;
    out.push(
      `Auf jedes Ziel wirfst du genau ${n === 1 ? 'einen Dart' : `${n} Darts`}, egal ob getroffen. Danach kommt das nächste Ziel, auch mitten in der Aufnahme.`,
      `Nach ${targetsOf(s).length} × ${n} Darts ist Schluss. Es gewinnt, wer die meisten Treffer hat.`,
    );
  }
  out.push('Am Ende siehst du für jedes Feld Würfe, Treffer und Trefferquote.');
  return out;
}

/** handicaps: eigener Startwert je Spieler (SPEC 7.1), nur wenn Handicap an ist. */
export function x01Rules(s: X01Settings, handicaps?: { name: string; start: number }[]): string[] {
  const own = handicaps?.filter((h) => h.start !== s.startScore) ?? [];
  const out = [
    own.length
      ? `Mit Handicap: ${handicaps!.map((h) => `${h.name} startet mit ${h.start}`).join(', ')} Punkten. Jeder wirft pro Aufnahme 3 Darts, die Punkte werden abgezogen.`
      : `Jeder Spieler startet mit ${s.startScore} Punkten und wirft pro Aufnahme 3 Darts. Die Punkte werden abgezogen.`,
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

// ---------- Varianten im Überblick (Wunsch Gianluca) ----------
// Neben den Regeln für die gewählten Einstellungen erklärt jede Regelansicht alle Varianten des Modus,
// damit man sieht, was sich z. B. bei Cut-Throat gegenüber Standard ändert.

export interface Variant {
  name: string;
  text: string;
}

const START_VARIANTS: Variant[] = [
  {
    name: 'Wer beginnt: Ausbullen',
    text: 'Jeder wirft einen Dart aufs Bull und markiert ihn. Wer am nächsten am Mittelpunkt liegt, beginnt; danach folgen die anderen nach Abstand.',
  },
  { name: 'Wer beginnt: Münzwurf', text: 'Der Zufall legt fest, wer beginnt (bei mehr als 2 Spielern die ganze Reihenfolge).' },
  { name: 'Wer beginnt: wie eingetragen', text: 'Es geht in der Reihenfolge los, in der die Spieler ausgewählt wurden.' },
];

const MATCH_VARIANTS: Variant[] = [
  { name: 'First to', text: 'Wer zuerst die eingestellte Zahl Legs gewinnt, gewinnt das Spiel. „First to 3“ heißt: 3 gewonnene Legs.' },
  { name: 'Best of', text: 'Gespielt wird höchstens die eingestellte Zahl Legs (immer ungerade). „Best of 5“ heißt: Wer zuerst 3 gewinnt.' },
  {
    name: 'Sets',
    text: 'Mit Sets zählt jedes gewonnene Leg für ein Set; wer genug Legs hat, gewinnt das Set. Das Spiel gewinnt, wer genug Sets gewinnt.',
  },
];

export function x01Variants(): Variant[] {
  return [
    {
      name: 'Startwert 301, 501, 701 oder frei',
      text: 'Bestimmt, wie lang ein Leg dauert. 501 ist der übliche Wert, 301 geht schneller, 701 dauert länger.',
    },
    { name: 'Single-In', text: IN_TEXT.single },
    { name: 'Double-In', text: IN_TEXT.double.replace(/^Double-In: /, '') },
    { name: 'Master-In', text: IN_TEXT.master.replace(/^Master-In: /, '') },
    { name: 'Single-Out', text: OUT_TEXT.single.replace(/^Single-Out: /, '') },
    { name: 'Double-Out', text: OUT_TEXT.double.replace(/^Double-Out: /, '') + ' Das ist die übliche Variante.' },
    { name: 'Master-Out', text: OUT_TEXT.master.replace(/^Master-Out: /, '') },
    ...MATCH_VARIANTS,
    {
      name: 'Checkout-Vorschläge: Experte',
      text: 'Die App zeigt die Wege, die Profis werfen würden: möglichst wenige Darts und ein gutes Double am Ende (z. B. D20, D16).',
    },
    {
      name: 'Checkout-Vorschläge: Einsteiger',
      text: 'Die App bevorzugt leichte Felder (große Singles) vor wenigen Darts, auch wenn es dafür einen Dart mehr braucht.',
    },
    { name: 'Checkout-Vorschläge: Aus', text: 'Es werden keine Wege angezeigt.' },
    {
      name: 'Handicap',
      text: 'Jeder Spieler kann einen eigenen Startwert bekommen, z. B. 501 gegen 301. So haben unterschiedlich starke Spieler eine faire Chance. Die Statistik vergleicht jeden nur mit Spielen vom selben Startwert.',
    },
    ...START_VARIANTS,
  ];
}

export function cricketVariants(): Variant[] {
  return [
    {
      name: 'Standard',
      text: 'Triffst du eine Zahl, die bei dir schon zu ist, bekommst du die Punkte – solange ein Gegner sie noch offen hat. Gewonnen hat, wer alles zu hat und mindestens so viele Punkte wie jeder Gegner. Punkte sind gut.',
    },
    {
      name: 'Cut-Throat',
      text: 'Umgekehrt: Triffst du eine Zahl, die bei dir zu ist, bekommen alle Gegner die Punkte, die sie noch offen haben. Gewonnen hat, wer alles zu hat und höchstens so viele Punkte wie jeder Gegner. Punkte sind schlecht – du „drückst“ sie den anderen auf.',
    },
    {
      name: 'Zielzahlen',
      text: 'Üblich sind 15 bis 20 und Bull. Du kannst beliebige Zahlen wählen, z. B. nur 20 und Bull für ein kurzes Spiel.',
    },
    {
      name: 'Treffer bis zu',
      text: 'Wie oft eine Zahl getroffen werden muss, bis sie zu ist. Üblich ist 3; mehr macht das Spiel länger, weniger kürzer.',
    },
    ...MATCH_VARIANTS,
    ...START_VARIANTS,
  ];
}

export function shanghaiVariants(): Variant[] {
  return [
    { name: 'Startzahl', text: 'Mit welcher Zahl Runde 1 beginnt. Danach geht es Runde für Runde eine Zahl höher, nach der 20 kommt das Bull.' },
    { name: 'Runden', text: 'Wie viele Runden gespielt werden. Üblich sind 20 (1 bis 20) oder 7 (1 bis 7).' },
    {
      name: 'Shanghai beendet das Spiel: ja',
      text: 'Nach einem Shanghai ist „Spiel beenden“ vorausgewählt: Wer es wirft, gewinnt sofort. Du kannst trotzdem „Weiterspielen“ wählen.',
    },
    {
      name: 'Shanghai beendet das Spiel: nein',
      text: 'Nach einem Shanghai ist „Weiterspielen“ vorausgewählt: Es wird vermerkt, am Ende zählen nur die Punkte.',
    },
    ...START_VARIANTS,
  ];
}

export function doublesVariants(): Variant[] {
  return [
    { name: 'Jeder seine eigene Zielfolge', text: 'Jeder Spieler bekommt die Ziele in einer anderen zufälligen Reihenfolge.' },
    { name: 'Alle dieselbe Zielfolge', text: 'Alle werfen die Ziele in derselben Reihenfolge – gut zum direkten Vergleich.' },
    {
      name: 'Bis zum Treffer',
      text: 'Ein Ziel bleibt, bis es getroffen ist. Es gewinnt, wer alle Ziele mit den wenigsten Darts schafft.',
    },
    {
      name: 'Feste Zahl Darts',
      text: 'Auf jedes Ziel gehen gleich viele Darts, egal ob getroffen. Es gewinnt, wer die meisten Treffer hat.',
    },
    { name: 'Ziele', text: 'Du kannst alle Doubles und das Bullseye üben oder nur einzelne, z. B. D16 und D20.' },
    ...START_VARIANTS,
  ];
}

export function countUpRules(s: CountUpSettings): string[] {
  return [
    `Gespielt werden ${s.rounds === 1 ? '1 Runde' : `${s.rounds} Runden`}. Pro Runde wirft jeder 3 Darts.`,
    'Jeder Dart zählt seine Punkte: Zahl mal Ring (Double doppelt, Triple dreifach), Single-Bull 25, Bullseye 50. Es wird nichts abgezogen.',
    'Nach der letzten Runde gewinnt, wer die meisten Punkte hat. Bei Gleichstand teilen sich die Spieler den Sieg.',
  ];
}

export function countUpVariants(): Variant[] {
  return [
    { name: 'Runden', text: 'Wie viele Runden gespielt werden (1–50). Üblich sind 8 Runden, also 24 Darts.' },
    ...START_VARIANTS,
  ];
}

export function atcRules(s: AtcSettings): string[] {
  const ring =
    s.ring === 'double'
      ? 'Es zählen nur Doubles.'
      : s.ring === 'triple'
        ? 'Es zählen nur Triples.'
        : 'Es zählt jeder Ring: Single, Double oder Triple.';
  const bull = s.withBull
    ? s.ring === 'any'
      ? ' Am Bull zählen Single-Bull und Bullseye.'
      : ' Am Bull zählt das Bullseye (ein Triple gibt es dort nicht).'
    : '';
  const out = [
    `Triff die Zahlen der Reihe nach: 1, 2, 3 … bis 20${s.withBull ? ' und zum Schluss das Bull' : ''}. Jeder wirft 3 Darts pro Aufnahme.`,
    ring + bull,
    'Triffst du dein Ziel, ist sofort das nächste dran, auch mitten in der Aufnahme. Auf dem Board ist nur dein aktuelles Ziel farbig.',
  ];
  if (s.ring === 'any' && s.jumps) {
    out.push('Mit Sprüngen: Ein Double bringt dich 2 Ziele weiter, ein Triple 3. Springst du über das letzte Ziel hinaus, bist du fertig.');
  }
  out.push('Wer zuerst das letzte Ziel trifft, gewinnt sofort.');
  return out;
}

export function atcVariants(): Variant[] {
  return [
    { name: 'Ziele 1–20', text: 'Die Zahlen 1 bis 20 der Reihe nach.' },
    { name: 'Ziele 1–20 + Bull', text: 'Zum Schluss muss noch das Bull getroffen werden.' },
    { name: 'Ring beliebig', text: 'Single, Double und Triple zählen gleich – der leichteste Einstieg.' },
    { name: 'Nur Doubles', text: 'Nur der äußere schmale Ring zählt – gutes Training für den Checkout.' },
    { name: 'Nur Triples', text: 'Nur der innere schmale Ring zählt – am Bull ersatzweise das Bullseye.' },
    {
      name: 'Sprünge',
      text: 'Nur bei Ring „beliebig“: Ein Double bringt 2 Ziele weiter, ein Triple 3. Das Spiel wird schneller, Doubles und Triples lohnen sich.',
    },
    ...START_VARIANTS,
  ];
}

export function bobsRules(s: BobsSettings): string[] {
  return [
    'Du startest mit 27 Punkten. Ziele sind D1, D2 … D20 und zum Schluss das Bullseye – auf jedes Ziel wirfst du eine Aufnahme mit 3 Darts.',
    'Nach jedem Dart tippst du „Treffer“ oder „Falsch“. Jeder Treffer bringt den Wert des Doubles (D7 = 14, Bullseye = 50).',
    'Triffst du in einer Aufnahme gar nicht, wird der Wert des Doubles einmal abgezogen.',
    s.dieAtZero
      ? 'Fällst du auf 0 oder darunter, scheidest du aus.'
      : 'Auch unter 0 spielst du bis zum Bullseye weiter.',
    'Am Ende gewinnt, wer die meisten Punkte hat. Deine Treffer zählen in die Doppelquote je Feld in der Statistik.',
  ];
}

export function bobsVariants(): Variant[] {
  return [
    {
      name: 'Bei 0 oder weniger ausscheiden: ja',
      text: 'Die übliche Form: Wer auf 0 oder darunter fällt, ist raus. Gut, um Druck auf die ersten, kleinen Doubles zu bekommen.',
    },
    {
      name: 'Bei 0 oder weniger ausscheiden: nein',
      text: 'Jeder spielt alle 21 Ziele durch, auch mit Minuspunkten – gut zum Üben aller Doubles.',
    },
    ...START_VARIANTS,
  ];
}

export function halveItRules(s: HalveItSettings): string[] {
  const names = s.targets.map((t) => (t === 'D' ? 'beliebiges Double' : t === 'T' ? 'beliebiges Triple' : halveTargetName(t)));
  return [
    `Gespielt wird ${names.length === 1 ? '1 Runde' : `${names.length} Runden`} mit diesen Zielen: ${names.join(', ')}.${
      s.startPoints ? ` Jeder startet mit ${s.startPoints} Punkten.` : ''
    }`,
    'Pro Runde wirft jeder 3 Darts auf das Ziel. Es zählt die Zahl mal Ring, beim Bull 25 bzw. 50. Bei „beliebiges Double“ zählt jedes Double mit seinem Wert (auch das Bullseye), bei „beliebiges Triple“ jedes Triple.',
    'Triffst du in einer Runde gar nicht, werden deine Gesamtpunkte halbiert (abgerundet).',
    'Nach der letzten Runde gewinnt, wer die meisten Punkte hat. Bei Gleichstand teilen sich die Spieler den Sieg.',
  ];
}

export function halveItVariants(): Variant[] {
  return [
    {
      name: 'Zielfolge',
      text: 'Üblich ist 15, 16, beliebiges Double, 17, 18, beliebiges Triple, 19, 20, Bull. Du kannst sie frei zusammenstellen, auch mit Zielen mehrfach.',
    },
    { name: 'Beliebiges Double / Triple', text: 'Jedes Double bzw. Triple zählt mit seinem Wert – du suchst dir aus, worauf du zielst.' },
    {
      name: 'Startpunkte',
      text: 'Mit Startpunkten (z. B. 40) hat ein früher Fehlwurf weniger Gewicht, weil es schon etwas zu halbieren gibt.',
    },
    ...START_VARIANTS,
  ];
}

export function one21Rules(s: One21Settings): string[] {
  const turns = s.dartsPerAttempt / 3;
  return [
    `Ziel ist, ${s.startTarget} zu checken. Für jeden Versuch hast du ${s.dartsPerAttempt} Darts (${turns === 1 ? '1 Aufnahme' : `${turns} Aufnahmen`}); die Spieler wechseln sich nach jeder Aufnahme ab.`,
    s.outMode === 'double'
      ? 'Wie bei X01 mit Double-Out: genau auf 0, der letzte Dart ein Double (auch das Bullseye).'
      : 'Wie bei X01 mit Master-Out: genau auf 0, der letzte Dart ein Double oder Triple (auch das Bullseye).',
    'Überwirfst du oder bleibt 1 übrig, ist die Aufnahme ein Bust: Der Rest springt auf den Stand vor der Aufnahme zurück. Der Versuch geht mit der nächsten Aufnahme weiter, solange er noch Darts hat.',
    `Schaffst du den Checkout, ist das nächste Ziel 1 höher. Schaffst du ihn nicht, ${
      s.afterFail === 'same' ? 'bleibt das Ziel gleich' : `geht das Ziel 1 runter (nie unter ${s.startTarget})`
    }.`,
    `Jeder hat ${s.attempts === 1 ? '1 Versuch' : `${s.attempts} Versuche`}. Es gewinnt, wer das höchste Ziel gecheckt hat, bei Gleichstand wer öfter gecheckt hat.`,
  ];
}

export function one21Variants(): Variant[] {
  return [
    { name: 'Startziel', text: 'Üblich ist 121. Niedrigere Ziele (ab 61) eignen sich zum Einstieg, höhere bis 170 für Fortgeschrittene.' },
    {
      name: 'Darts pro Versuch',
      text: '3, 6, 9 oder 12 Darts. Mit 9 Darts (3 Aufnahmen) ist 121 die klassische Form; weniger Darts machen es schwerer.',
    },
    { name: 'Double-Out', text: 'Der letzte Dart muss ein Double sein (oder das Bullseye) – wie im Turnier.' },
    { name: 'Master-Out', text: 'Der letzte Dart darf ein Double oder ein Triple sein – etwas leichter.' },
    { name: 'Nach Fehlschlag: gleiches Ziel', text: 'Du versuchst dasselbe Ziel noch einmal.' },
    { name: 'Nach Fehlschlag: Ziel −1', text: 'Das Ziel geht 1 runter, aber nie unter das Startziel – so bleibst du im Bereich, den du schaffst.' },
    { name: 'Versuche', text: 'Wie viele Versuche jeder Spieler hat (1–50).' },
    ...START_VARIANTS,
  ];
}
