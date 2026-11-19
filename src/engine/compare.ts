// Vergleich in der Langzeitstatistik (SPEC 11.7): Spieler nebeneinander, direkte Duelle, Zeiträume.
// Alles wird aus den Legs (LegRecord) bzw. Spielen berechnet; gespeichert wird nichts.

import type { AppEvent } from './events';
import { computeGame, listGames, type GameInfo } from './games';
import type { Mode } from './metrics';
import { bestRecord, type LegRecord, type MetricDef } from './records';

export interface MetricSummary {
  /** Schnitt der Werte (je Leg), null ohne Werte. */
  avg: number | null;
  /** Rekord (bester Wert eines abgeschlossenen Legs), null ohne Werte. */
  best: number | null;
  /** Legs mit einem Wert dieser Kennzahl. */
  count: number;
}

/** Schnitt und Rekord einer Kennzahl über Legs. */
export function summarize(records: readonly LegRecord[], def: MetricDef): MetricSummary {
  const vals = records.map((r) => r.values[def.key]).filter((v): v is number => v !== undefined);
  const best = bestRecord(records, def);
  return {
    avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
    best: best?.values[def.key] ?? null,
    count: vals.length,
  };
}

/** Ist a besser als b, gemessen an der Richtung der Kennzahl? */
export const better = (def: MetricDef, a: number, b: number) => (def.better === 'higher' ? a > b : a < b);

// ---------- Quote je Doppel (SPEC 11.7) ----------

/** Doppel in Board-Reihenfolge der Auswertung: D1 … D20, Bull. */
export const DOUBLE_KEYS = [...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'DB'];

export type FieldTally = Record<string, { darts: number; hits: number }>;

/** Würfe und Treffer je Doppel über Legs, aus allen Quellen (Training, Bob's 27, Checkouts). */
export function doubleFields(records: readonly LegRecord[]): FieldTally {
  const out: FieldTally = {};
  for (const r of records) {
    for (const [k, v] of Object.entries(r.doubles)) {
      const t = (out[k] ??= { darts: 0, hits: 0 });
      t.darts += v.darts;
      t.hits += v.hits;
    }
  }
  return out;
}

/** Quote in Prozent, null ohne Würfe. */
export const fieldRate = (t?: { darts: number; hits: number }) => (t && t.darts ? (t.hits / t.darts) * 100 : null);

// ---------- Spieler nebeneinander ----------

export interface PlayerComparison {
  /** Gemeinsame Vergleichsgruppe und ihr Name; null, wenn keiner der Spieler Legs hat. */
  group: string | null;
  groupLabel: string;
  /** Alle Gruppen der gewählten Spieler mit Legs zusammen, meistgespielte zuerst (zur Auswahl). */
  groups: { group: string; label: string; count: number }[];
  /** Legs je Spieler in der Gruppe. */
  legs: Record<string, LegRecord[]>;
  /** Je Kennzahl und Spieler Schnitt und Rekord, dazu die Spieler mit dem besten Schnitt. */
  rows: { def: MetricDef; per: Record<string, MetricSummary>; leaders: string[] }[];
}

/**
 * `records`: abgeschlossene Legs im gewählten Modus und Zeitraum (alle Profile).
 * Standardgruppe = die mit den meisten Legs der gewählten Spieler zusammen (SPEC 11.7, G93).
 */
export function comparePlayers(
  records: readonly LegRecord[],
  profileIds: readonly string[],
  defs: readonly MetricDef[],
  groupSel?: string | null,
): PlayerComparison {
  const mine = records.filter((r) => profileIds.includes(r.profileId));
  const counts = new Map<string, { label: string; count: number }>();
  for (const r of mine) {
    const c = counts.get(r.group) ?? { label: r.groupLabel, count: 0 };
    c.count++;
    counts.set(r.group, c);
  }
  const groups = [...counts.entries()].map(([group, c]) => ({ group, ...c })).sort((a, b) => b.count - a.count);
  const group = groups.find((g) => g.group === groupSel)?.group ?? groups[0]?.group ?? null;
  const legs = Object.fromEntries(profileIds.map((id) => [id, mine.filter((r) => r.profileId === id && r.group === group)]));
  const rows = defs
    .map((def) => {
      const per = Object.fromEntries(profileIds.map((id) => [id, summarize(legs[id], def)]));
      const avgs = profileIds.map((id) => per[id].avg).filter((v): v is number => v !== null);
      const top = avgs.length ? avgs.reduce((m, v) => (better(def, v, m) ? v : m)) : null;
      // Hervorheben nur, wenn es etwas zu vergleichen gibt (mindestens zwei Spieler mit Werten, nicht alle gleich)
      const allEqual = avgs.every((v) => v === avgs[0]);
      const leaders = top === null || avgs.length < 2 || allEqual ? [] : profileIds.filter((id) => per[id].avg === top);
      return { def, per, leaders };
    })
    .filter((row) => profileIds.some((id) => row.per[id].count > 0));
  return { group, groupLabel: groups.find((g) => g.group === group)?.label ?? '', groups, legs, rows };
}

// ---------- Direkter Vergleich ----------

export interface Duel {
  gameId: string;
  ts: number;
  /** 'a', 'b', 'draw' (beide unter den Siegern) oder 'other' (ein Dritter hat gewonnen). */
  result: 'a' | 'b' | 'draw' | 'other';
  /** Gewonnene Legs (nur Modi mit Legs). */
  legsA: number;
  legsB: number;
}

export interface DuelSummary {
  duels: Duel[];
  winsA: number;
  winsB: number;
  draws: number;
  others: number;
  legsA: number;
  legsB: number;
  /** Kennzahlen beider nur aus diesen Spielen. */
  rows: { def: MetricDef; a: MetricSummary; b: MetricSummary }[];
  /** Abgeschlossene Legs beider aus diesen Spielen (z. B. für die Quote je Doppel). */
  recordsA: LegRecord[];
  recordsB: LegRecord[];
}

const MODES_WITH_LEGS: Mode[] = ['x01', 'cricket'];

/**
 * Beendete Spiele des Modus, in denen beide Profile mitgespielt haben (SPEC 11.7, G94).
 * `records`: Legs aller Profile (für die Kennzahlen), `since`: frühester Spielstart.
 */
export function duels(
  events: readonly AppEvent[],
  records: readonly LegRecord[],
  a: string,
  b: string,
  mode: Mode,
  defs: readonly MetricDef[],
  opts: { since?: number; withBots?: boolean } = {},
): DuelSummary {
  const slotOf = (g: GameInfo, id: string) => g.created.participants.find((p) => p.kind === 'profile' && p.profileId === id)?.slot;
  const games = listGames(events).filter((g) => {
    const c = g.created;
    if (g.hidden || g.ended !== 'finished' || c.mode !== mode || g.createdAt < (opts.since ?? 0)) return false;
    if (opts.withBots === false && c.participants.some((p) => p.kind === 'bot')) return false;
    // Count-Up zusammen ist ein Team-Spiel, kein Duell
    if (c.mode === 'countup' && c.settings.scoring === 'team') return false;
    return slotOf(g, a) !== undefined && slotOf(g, b) !== undefined;
  });
  const out: Duel[] = games.map((g) => {
    const sa = slotOf(g, a)!;
    const sb = slotOf(g, b)!;
    const { state } = computeGame(g, events);
    const winners = state.matchWinners ?? [];
    const wa = winners.includes(sa);
    const wb = winners.includes(sb);
    const legs = MODES_WITH_LEGS.includes(mode) ? state.legsWon : null;
    return {
      gameId: g.created.gameId,
      ts: g.createdAt,
      result: wa && wb ? 'draw' : wa ? 'a' : wb ? 'b' : 'other',
      legsA: legs?.[sa] ?? 0,
      legsB: legs?.[sb] ?? 0,
    };
  });
  const ids = new Set(out.map((d) => d.gameId));
  const legsOf = (id: string) => records.filter((r) => r.profileId === id && ids.has(r.gameId) && r.complete);
  const ra = legsOf(a);
  const rb = legsOf(b);
  const count = (r: Duel['result']) => out.filter((d) => d.result === r).length;
  return {
    duels: out.sort((x, y) => y.ts - x.ts),
    recordsA: ra,
    recordsB: rb,
    winsA: count('a'),
    winsB: count('b'),
    draws: count('draw'),
    others: count('other'),
    legsA: out.reduce((n, d) => n + d.legsA, 0),
    legsB: out.reduce((n, d) => n + d.legsB, 0),
    rows: defs
      .map((def) => ({ def, a: summarize(ra, def), b: summarize(rb, def) }))
      .filter((row) => row.a.count > 0 || row.b.count > 0),
  };
}

// ---------- Zeiträume ----------

export interface PeriodRow {
  def: MetricDef;
  before: MetricSummary;
  now: MetricSummary;
  /** jetzt − vorher, null wenn einer fehlt. */
  delta: number | null;
  /** Veränderung ist besser (true), schlechter (false) oder gleich/unbekannt (null). */
  improved: boolean | null;
}

const DAY = 86_400_000;

/** Legs der letzten `days` Tage („recent“) und der `days` Tage davor („earlier“). */
export function splitPeriods(records: readonly LegRecord[], days: number, now: number) {
  const cut = now - days * DAY;
  const start = now - 2 * days * DAY;
  return {
    recent: records.filter((r) => r.ts >= cut && r.ts <= now),
    earlier: records.filter((r) => r.ts >= start && r.ts < cut),
  };
}

/**
 * „Jetzt“ = die letzten `days` Tage, „vorher“ = die `days` Tage davor (SPEC 11.7, G95, G96).
 * `records`: abgeschlossene Legs eines Profils in einer Vergleichsgruppe.
 */
export function comparePeriods(records: readonly LegRecord[], defs: readonly MetricDef[], days: number, now: number): PeriodRow[] {
  const { earlier, recent } = splitPeriods(records, days, now);
  return defs
    .map((def) => {
      const before = summarize(earlier, def);
      const cur = summarize(recent, def);
      const delta = before.avg !== null && cur.avg !== null ? cur.avg - before.avg : null;
      const improved = delta === null || delta === 0 ? null : better(def, cur.avg!, before.avg!);
      return { def, before, now: cur, delta, improved };
    })
    .filter((row) => row.before.count > 0 || row.now.count > 0);
}

