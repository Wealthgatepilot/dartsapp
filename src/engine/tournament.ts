// Turnier (SPEC 8): Auslosung, Spielplan, Ergebnisse und Tabelle – alles aus „Turnier angelegt“ und den Spielen.
// Gespeichert wird nur tournament.created (plus Ausbullen nach Gleichstand und Ende); der Rest wird berechnet.

import { seededRandom } from './bot';
import type { Race } from './core';
import type { AppEvent, GameCreatedPayload, StartMethod } from './events';
import { computeGame, type AnyGameState, type GameInfo } from './games';
import { atcMetrics, countUpMetrics, cricketLegMetrics, halveItMetrics, shanghaiMetrics } from './metrics';
import { matchNumbers } from './stats';

// ---------- Ereignisse ----------

/** Modi, die im Turnier wählbar sind (Wahl Gianluca, SPEC 8.2). */
export const TOURNAMENT_MODES = ['x01', 'cricket', 'shanghai', 'countup', 'atc', 'halveit'] as const;
export type TournamentMode = (typeof TOURNAMENT_MODES)[number];

/** Modus mit Einstellungen, wie bei game.created (X01 mit Checkout-Hilfe). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type TournamentGameSpec = DistributiveOmit<
  Extract<GameCreatedPayload, { mode: TournamentMode }>,
  'gameId' | 'participants' | 'seed' | 'start' | 'tournament'
>;

export type TournamentFormat =
  | { kind: 'ko'; thirdPlace: boolean }
  | { kind: 'league'; twice: boolean }
  | { kind: 'groups'; groups: number; advance: number; thirdPlace: boolean };

export interface Entrant {
  id: string;
  kind: 'profile' | 'guest' | 'bot';
  profileId?: string;
  guestName?: string;
  botLevel?: number;
  botHuman?: boolean;
}

export type TournamentCreatedPayload = {
  tournamentId: string;
  name: string;
  start: StartMethod;
  format: TournamentFormat;
  entrants: Entrant[];
  seed: number;
  /** Eigene Leg-Zahl für Finale und Spiel um Platz 3 (nur X01 und Cricket). */
  finalLegs?: Race;
} & TournamentGameSpec;

export interface TiebreakPayload {
  tournamentId: string;
  matchId: string;
  gameId: string;
  /** Teilnehmer-ID des Siegers im Ausbullen. */
  winner: string;
}

export const MAX_ENTRANTS = 32;
export const GROUP_COUNTS = [2, 4, 8];
export const ADVANCE_COUNTS = [1, 2];

// ---------- Spielplan ----------

/** Woher ein Platz einer Partie kommt. */
export type Source =
  | { kind: 'entrant'; id: string }
  | { kind: 'bye' }
  | { kind: 'winner'; of: string }
  | { kind: 'loser'; of: string }
  | { kind: 'group'; group: number; place: number };

export interface MatchDef {
  id: string;
  stage: 'ko' | 'league' | 'group';
  /** Runde ab 1 (im K.-o. von der ersten Runde an gezählt). */
  round: number;
  group?: number;
  a: Source;
  b: Source;
  /** Finale bzw. Spiel um Platz 3: eigene Leg-Zahl. */
  final?: boolean;
  thirdPlace?: boolean;
}

export interface TournamentPlan {
  matches: MatchDef[];
  /** Gruppen mit ihren Teilnehmern (nur Gruppen + K.-o.). */
  groups: string[][];
  /** Anzahl der K.-o.-Runden (0 ohne K.-o.). */
  koRounds: number;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Ist die Turnierform mit dieser Teilnehmerzahl möglich? Sonst ein Satz, was fehlt. */
export function formatError(format: TournamentFormat, entrants: number): string | null {
  if (entrants < 2) return 'Mindestens zwei Teilnehmer.';
  if (entrants > MAX_ENTRANTS) return `Höchstens ${MAX_ENTRANTS} Teilnehmer.`;
  if (format.kind === 'groups') {
    if (!GROUP_COUNTS.includes(format.groups) || !ADVANCE_COUNTS.includes(format.advance)) return 'Ungültige Gruppen-Einstellung.';
    const need = format.groups * (format.advance + 1);
    if (entrants < need) return `Für ${format.groups} Gruppen mit ${format.advance} Weiterkommenden braucht es mindestens ${need} Teilnehmer.`;
  }
  return null;
}

/**
 * K.-o.-Baum (SPEC 8.2). Die erste Runde bekommt die Plätze in der gegebenen Reihenfolge paarweise;
 * fehlende Plätze sind Freilose, je Partie höchstens eines. `drawByes`: Freilose zufällig verteilen.
 */
function koMatches(entries: Source[], thirdPlace: boolean, random: (() => number) | null): { matches: MatchDef[]; rounds: number } {
  const rounds = Math.max(1, Math.ceil(Math.log2(entries.length)));
  const size = 2 ** rounds;
  const pairs = size / 2;
  const byes = size - entries.length;
  // Welche Partien der ersten Runde ein Freilos haben: zufällig, ohne Zufall die letzten
  const byePairs = new Set(
    random ? shuffle(Array.from({ length: pairs }, (_, i) => i), random).slice(0, byes) : Array.from({ length: byes }, (_, i) => pairs - 1 - i),
  );
  const matches: MatchDef[] = [];
  let next = 0;
  for (let m = 0; m < pairs; m++) {
    const a = entries[next++];
    const b: Source = byePairs.has(m) ? { kind: 'bye' } : entries[next++];
    matches.push({ id: `ko-r1-m${m + 1}`, stage: 'ko', round: 1, a, b, final: rounds === 1 });
  }
  for (let r = 2; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let m = 1; m <= count; m++) {
      matches.push({
        id: `ko-r${r}-m${m}`,
        stage: 'ko',
        round: r,
        a: { kind: 'winner', of: `ko-r${r - 1}-m${2 * m - 1}` },
        b: { kind: 'winner', of: `ko-r${r - 1}-m${2 * m}` },
        final: r === rounds,
      });
    }
  }
  if (thirdPlace && rounds >= 2) {
    matches.push({
      id: 'ko-p3',
      stage: 'ko',
      round: rounds,
      a: { kind: 'loser', of: `ko-r${rounds - 1}-m1` },
      b: { kind: 'loser', of: `ko-r${rounds - 1}-m2` },
      thirdPlace: true,
    });
  }
  return { matches, rounds };
}

/**
 * Jeder gegen jeden nach dem Kreisverfahren: Der erste Platz bleibt fest, die anderen rücken je Runde weiter.
 * Bei ungerader Zahl hat je Runde einer spielfrei. Liefert Runden mit Paarungen.
 */
export function roundRobin(ids: readonly string[], twice: boolean): [string, string][][] {
  const list: (string | null)[] = [...ids];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rounds: [string, string][][] = [];
  let arr = list;
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = arr[i];
      const y = arr[n - 1 - i];
      if (x === null || y === null) continue;
      // Anwurf abwechseln, damit der feste Platz nicht immer beginnt
      pairs.push(i === 0 && r % 2 === 1 ? [y, x] : [x, y]);
    }
    rounds.push(pairs);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  if (twice) for (const pairs of [...rounds]) rounds.push(pairs.map(([x, y]) => [y, x]));
  return rounds;
}

/** Spielplan eines Turniers; gleiche Zufallszahl → gleiche Auslosung. */
export function planTournament(t: Pick<TournamentCreatedPayload, 'format' | 'entrants' | 'seed'>): TournamentPlan {
  const random = seededRandom(t.seed);
  const ids = t.entrants.map((e) => e.id);
  const f = t.format;
  if (f.kind === 'ko') {
    const { matches, rounds } = koMatches(
      shuffle(ids, random).map((id) => ({ kind: 'entrant', id })),
      f.thirdPlace,
      random,
    );
    return { matches, groups: [], koRounds: rounds };
  }
  if (f.kind === 'league') {
    const matches: MatchDef[] = [];
    roundRobin(shuffle(ids, random), f.twice).forEach((pairs, r) =>
      pairs.forEach(([a, b], k) =>
        matches.push({ id: `rr-${r + 1}-${k + 1}`, stage: 'league', round: r + 1, a: { kind: 'entrant', id: a }, b: { kind: 'entrant', id: b } }),
      ),
    );
    return { matches, groups: [], koRounds: 0 };
  }
  // Gruppen + K.-o.: zufällig auf die Gruppen verteilen, möglichst gleich groß
  const groups: string[][] = Array.from({ length: f.groups }, () => []);
  shuffle(ids, random).forEach((id, i) => groups[i % f.groups].push(id));
  const matches: MatchDef[] = [];
  groups.forEach((members, g) =>
    roundRobin(members, false).forEach((pairs, r) =>
      pairs.forEach(([a, b], k) =>
        matches.push({
          id: `g${g + 1}-${r + 1}-${k + 1}`,
          stage: 'group',
          group: g + 1,
          round: r + 1,
          a: { kind: 'entrant', id: a },
          b: { kind: 'entrant', id: b },
        }),
      ),
    ),
  );
  const place = (group: number, p: number): Source => ({ kind: 'group', group, place: p });
  const entries: Source[] = [];
  if (f.advance === 1) {
    for (let g = 1; g <= f.groups; g++) entries.push(place(g, 1));
  } else {
    // A1–B2, C1–D2 … in der oberen Hälfte, B1–A2, D1–C2 … in der unteren: Gruppensieger treffen sich spät
    const top: Source[] = [];
    const bottom: Source[] = [];
    for (let g = 1; g <= f.groups; g += 2) {
      top.push(place(g, 1), place(g + 1, 2));
      bottom.push(place(g + 1, 1), place(g, 2));
    }
    entries.push(...top, ...bottom);
  }
  const ko = koMatches(entries, f.thirdPlace, null);
  return { matches: [...matches, ...ko.matches], groups, koRounds: ko.rounds };
}

// ---------- Ergebnisse ----------

export interface MatchResult {
  winner: string;
  loser: string | null;
  /** Legs von Platz a bzw. b (Modi ohne Legs: 1:0). */
  legsA: number;
  legsB: number;
  gameId: string | null;
}

/** Messbare Kennzahl je Spieler eines Spiels für Regel 5 der Tabelle (Zähler/Nenner, damit sie summierbar ist). */
export interface StatPart {
  num: number;
  den: number;
}

export interface MatchView {
  def: MatchDef;
  /** Teilnehmer-IDs; null = steht noch nicht fest; 'bye' = Freilos. */
  a: string | 'bye' | null;
  b: string | 'bye' | null;
  status: 'waiting' | 'ready' | 'playing' | 'tiebreak' | 'done';
  result: MatchResult | null;
  /** Laufendes bzw. zuletzt beendetes Spiel dieser Partie. */
  gameId: string | null;
  /** Kennzahl je Platz (für die Tabelle). */
  stats: { a: StatPart; b: StatPart } | null;
}

export interface StandingRow {
  id: string;
  played: number;
  won: number;
  lost: number;
  legsFor: number;
  legsAgainst: number;
  points: number;
  stat: number | null;
}

export interface TournamentState {
  created: TournamentCreatedPayload;
  createdAt: number;
  plan: TournamentPlan;
  matches: MatchView[];
  /** Tabelle je Gruppe bzw. eine Tabelle bei Jeder gegen jeden. */
  tables: StandingRow[][];
  /** Alle Partien entschieden. */
  complete: boolean;
  /** Platzierung, sobald feststeht (Sieger zuerst). */
  podium: string[];
  ended: 'finished' | 'abandoned' | null;
}

/** Ergebnis eines beendeten Spiels aus Sicht der Partie: Slot 0 = Platz a, Slot 1 = Platz b. */
export function gameOutcome(g: AnyGameState): { winners: number[]; legs: [number, number]; stats: [StatPart, StatPart] } | null {
  const s = g.state;
  if (!s.finished || !s.matchWinners) return null;
  const withLegs = g.mode === 'x01' || g.mode === 'cricket';
  const legs: [number, number] = withLegs
    ? [0, 1].map((slot) => s.legs.filter((l) => l.winner === slot).length) as [number, number]
    : [s.matchWinners.length === 1 && s.matchWinners[0] === 0 ? 1 : 0, s.matchWinners.length === 1 && s.matchWinners[0] === 1 ? 1 : 0];
  return { winners: s.matchWinners, legs, stats: [statOf(g, 0), statOf(g, 1)] };
}

/** Kennzahl für Regel 5 (SPEC 8.4) als Zähler und Nenner. */
export function statOf(g: AnyGameState, slot: number): StatPart {
  switch (g.mode) {
    case 'x01': {
      const n = matchNumbers(g.state.legs, slot);
      return { num: n.points * 3, den: n.darts };
    }
    case 'cricket': {
      let marks = 0;
      let darts = 0;
      for (const leg of g.state.legs) {
        const m = cricketLegMetrics(leg, slot);
        marks += m.marks;
        darts += m.darts;
      }
      return { num: marks * 3, den: darts };
    }
    case 'shanghai': {
      const m = shanghaiMetrics(g.state, slot);
      return { num: m.points * 3, den: m.darts };
    }
    case 'countup': {
      const m = countUpMetrics(g.state, slot);
      return { num: m.points * 3, den: m.darts };
    }
    case 'halveit': {
      const m = halveItMetrics(g.state, slot);
      return { num: m.points * 3, den: m.darts };
    }
    case 'atc': {
      const m = atcMetrics(g.state, slot);
      return { num: m.hits * 100, den: m.darts };
    }
    default:
      return { num: 0, den: 0 };
  }
}

/** Turniere aus den Ereignissen (neueste zuerst), ohne Spielstände. */
export function listTournaments(events: readonly AppEvent[]): { created: TournamentCreatedPayload; createdAt: number; ended: 'finished' | 'abandoned' | null }[] {
  const map = new Map<string, { created: TournamentCreatedPayload; createdAt: number; ended: 'finished' | 'abandoned' | null }>();
  for (const e of events) {
    if (e.type === 'tournament.created' && !map.has(e.payload.tournamentId)) {
      map.set(e.payload.tournamentId, { created: e.payload, createdAt: e.ts, ended: null });
    }
    if (e.type === 'tournament.ended') {
      const t = map.get(e.payload.tournamentId);
      if (t && !t.ended) t.ended = e.payload.reason;
    }
  }
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/** Vollständiger Stand eines Turniers aus den Ereignissen und Spielen. */
export function computeTournament(
  info: { created: TournamentCreatedPayload; createdAt: number; ended: 'finished' | 'abandoned' | null },
  games: readonly GameInfo[],
  events: readonly AppEvent[],
): TournamentState {
  const t = info.created;
  const plan = planTournament(t);
  const tiebreaks = new Map<string, string>();
  for (const e of events) {
    if (e.type === 'tournament.tiebreak' && e.payload.tournamentId === t.tournamentId) {
      tiebreaks.set(`${e.payload.matchId}|${e.payload.gameId}`, e.payload.winner);
    }
  }
  // Spiele je Partie, älteste zuerst
  const gamesOf = new Map<string, GameInfo[]>();
  for (const g of [...games].reverse()) {
    const tag = g.created.tournament;
    if (!tag || tag.tournamentId !== t.tournamentId || g.hidden) continue;
    const list = gamesOf.get(tag.matchId) ?? [];
    list.push(g);
    gamesOf.set(tag.matchId, list);
  }

  const views = new Map<string, MatchView>();
  const tables: StandingRow[][] = [];
  const groupPlaces = new Map<string, string>();

  const resolve = (s: Source): string | 'bye' | null => {
    switch (s.kind) {
      case 'entrant':
        return s.id;
      case 'bye':
        return 'bye';
      case 'winner': {
        const r = views.get(s.of)?.result;
        return r ? r.winner : null;
      }
      case 'loser': {
        const v = views.get(s.of);
        if (!v?.result) return null;
        return v.result.loser ?? 'bye';
      }
      case 'group':
        return groupPlaces.get(`${s.group}|${s.place}`) ?? null;
    }
  };

  const evaluate = (def: MatchDef): MatchView => {
    const a = resolve(def.a);
    const b = resolve(def.b);
    const view: MatchView = { def, a, b, status: 'waiting', result: null, gameId: null, stats: null };
    if (a === null || b === null) return view;
    if (a === 'bye' || b === 'bye') {
      // Freilos: der andere kommt ohne Spiel weiter (zwei Freilose gibt es nicht; beim Platz-3-Spiel möglich)
      const winner = a === 'bye' ? b : a;
      if (winner === 'bye') return { ...view, status: 'done' };
      return { ...view, status: 'done', result: { winner, loser: null, legsA: 0, legsB: 0, gameId: null } };
    }
    view.status = 'ready';
    const list = gamesOf.get(def.id) ?? [];
    const running = [...list].reverse().find((g) => !g.ended);
    const finished = [...list].reverse().find((g) => g.ended === 'finished');
    if (finished) {
      const out = gameOutcome(computeGame(finished, events));
      if (out) {
        view.gameId = finished.created.gameId;
        view.stats = { a: out.stats[0], b: out.stats[1] };
        let winnerSlot: number | null = out.winners.length === 1 ? out.winners[0] : null;
        if (winnerSlot === null) {
          const tb = tiebreaks.get(`${def.id}|${finished.created.gameId}`);
          if (tb === a) winnerSlot = 0;
          else if (tb === b) winnerSlot = 1;
        }
        if (winnerSlot === null) return { ...view, status: 'tiebreak' };
        const winner = winnerSlot === 0 ? a : b;
        return {
          ...view,
          status: 'done',
          result: { winner, loser: winnerSlot === 0 ? b : a, legsA: out.legs[0], legsB: out.legs[1], gameId: finished.created.gameId },
        };
      }
    }
    if (running) return { ...view, status: 'playing', gameId: running.created.gameId };
    return view;
  };

  // Tabellenphase zuerst (Jeder gegen jeden bzw. Gruppen), dann der K.-o.-Baum der Reihe nach
  const tablePhase = plan.matches.filter((m) => m.stage !== 'ko');
  for (const def of tablePhase) views.set(def.id, evaluate(def));
  if (t.format.kind === 'league') {
    tables.push(standings(t.entrants.map((e) => e.id), tablePhase.map((d) => views.get(d.id)!), t.seed));
  }
  if (t.format.kind === 'groups') {
    plan.groups.forEach((members, gi) => {
      const ms = tablePhase.filter((d) => d.group === gi + 1).map((d) => views.get(d.id)!);
      const table = standings(members, ms, t.seed);
      tables.push(table);
      // Plätze stehen erst fest, wenn die Gruppe fertig ist
      if (ms.every((m) => m.status === 'done')) table.forEach((row, i) => groupPlaces.set(`${gi + 1}|${i + 1}`, row.id));
    });
  }
  for (const def of plan.matches.filter((m) => m.stage === 'ko')) views.set(def.id, evaluate(def));

  const matches = plan.matches.map((d) => views.get(d.id)!);
  const complete = matches.every((m) => m.status === 'done');
  const podium: string[] = [];
  if (t.format.kind === 'league') {
    if (complete) podium.push(...tables[0].map((r) => r.id));
  } else {
    const final = matches.find((m) => m.def.final);
    if (final?.result) {
      podium.push(final.result.winner);
      if (final.result.loser) podium.push(final.result.loser);
      const p3 = matches.find((m) => m.def.thirdPlace);
      if (p3?.result) {
        podium.push(p3.result.winner);
        if (p3.result.loser) podium.push(p3.result.loser);
      }
    }
  }
  return { created: t, createdAt: info.createdAt, plan, matches, tables, complete, podium, ended: info.ended ?? null };
}

/**
 * Tabelle (SPEC 8.4): Punkte, Leg-Differenz, gewonnene Legs, direkter Vergleich, Kennzahl, Los.
 * Ein Sieg zählt 2 Punkte.
 */
export function standings(ids: readonly string[], matches: readonly MatchView[], seed: number): StandingRow[] {
  const rows = new Map<string, StandingRow & { statNum: number; statDen: number }>();
  for (const id of ids) rows.set(id, { id, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, points: 0, stat: null, statNum: 0, statDen: 0 });
  const done = matches.filter((m) => m.status === 'done' && m.result && m.result.loser && typeof m.a === 'string' && typeof m.b === 'string');
  for (const m of done) {
    const r = m.result!;
    const a = rows.get(m.a as string);
    const b = rows.get(m.b as string);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    a.legsFor += r.legsA;
    a.legsAgainst += r.legsB;
    b.legsFor += r.legsB;
    b.legsAgainst += r.legsA;
    const winner = r.winner === a.id ? a : b;
    const loser = winner === a ? b : a;
    winner.won++;
    winner.points += 2;
    loser.lost++;
    if (m.stats) {
      a.statNum += m.stats.a.num;
      a.statDen += m.stats.a.den;
      b.statNum += m.stats.b.num;
      b.statDen += m.stats.b.den;
    }
  }
  for (const r of rows.values()) r.stat = r.statDen ? r.statNum / r.statDen : null;

  // Los: feste Zufallsreihenfolge aus der Turnier-Zufallszahl
  const lot = new Map(shuffle([...ids].sort(), seededRandom(seed ^ 0x5bd1e995)).map((id, i) => [id, i]));
  /** Punkte nur aus Partien der Gleichen untereinander. */
  const direct = (id: string, group: Set<string>) =>
    done.filter((m) => group.has(m.a as string) && group.has(m.b as string) && m.result!.winner === id).length * 2;

  const base = (x: StandingRow, y: StandingRow) =>
    y.points - x.points || (y.legsFor - y.legsAgainst) - (x.legsFor - x.legsAgainst) || y.legsFor - x.legsFor;
  const sorted = [...rows.values()].sort(base);
  // Gleiche nach Regel 1–3 als Block: direkter Vergleich, Kennzahl, Los
  const result: StandingRow[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && base(sorted[i], sorted[j]) === 0) j++;
    const block = sorted.slice(i, j);
    const group = new Set(block.map((r) => r.id));
    block.sort((x, y) => direct(y.id, group) - direct(x.id, group) || (y.stat ?? -1) - (x.stat ?? -1) || lot.get(x.id)! - lot.get(y.id)!);
    result.push(...block);
    i = j;
  }
  return result.map((r) => ({
    id: r.id,
    played: r.played,
    won: r.won,
    lost: r.lost,
    legsFor: r.legsFor,
    legsAgainst: r.legsAgainst,
    points: r.points,
    stat: r.stat,
  }));
}

/** Leg-Format einer Partie: Finale und Platz 3 mit eigener Leg-Zahl (SPEC 8.2). */
export function matchSpec(t: TournamentCreatedPayload, def: MatchDef): TournamentGameSpec {
  const spec = { mode: t.mode, settings: t.settings, ...('advice' in t ? { advice: t.advice } : {}) } as TournamentGameSpec;
  if ((def.final || def.thirdPlace) && t.finalLegs && (spec.mode === 'x01' || spec.mode === 'cricket')) {
    return { ...spec, settings: { ...spec.settings, legs: t.finalLegs } } as TournamentGameSpec;
  }
  return spec;
}

/** Spieler eines Spiels aus einem Turnier-Teilnehmer. */
export function participantOf(e: Entrant, slot: number): GameCreatedPayload['participants'][number] {
  return {
    slot,
    kind: e.kind,
    ...(e.profileId ? { profileId: e.profileId } : {}),
    ...(e.guestName ? { guestName: e.guestName } : {}),
    ...(e.botLevel !== undefined ? { botLevel: e.botLevel } : {}),
    ...(e.botHuman !== undefined ? { botHuman: e.botHuman } : {}),
  };
}

/** game.created für eine Partie (Platz a = Slot 0, Platz b = Slot 1). */
export function matchGame(t: TournamentCreatedPayload, view: MatchView, gameId: string, seed: number): GameCreatedPayload {
  const byId = new Map(t.entrants.map((e) => [e.id, e]));
  const a = byId.get(view.a as string)!;
  const b = byId.get(view.b as string)!;
  return {
    ...matchSpec(t, view.def),
    gameId,
    participants: [participantOf(a, 0), participantOf(b, 1)],
    seed,
    start: t.start,
    tournament: { tournamentId: t.tournamentId, matchId: view.def.id },
  } as GameCreatedPayload;
}
