// Langzeitstatistik je Profil (SPEC 11.1, 11.6, 12): Aus allen Spielen entsteht je Profil und Leg
// (bzw. Durchgang) ein Eintrag mit Kennzahlen. Daraus rechnen Verlauf, Heatmap, Doppelquote und Rekorde.

import type { AppEvent } from './events';
import { computeGame, listGames, type GameInfo } from './games';
import {
  atcMetrics,
  bobsMetrics,
  countUpMetrics,
  cricketLegMetrics,
  doublesMetrics,
  halveItMetrics,
  heatKey,
  shanghaiMetrics,
  x01LegMetrics,
  type DoubleTally,
  type Mode,
} from './metrics';
import { atcVariantLabel } from './atc';
import { targetsOf } from './doubles';
import { halveTargetName } from './halveit';

/** Kennzahlen, die sich über die Zeit vergleichen lassen. */
export type MetricKey =
  | 'avg'
  | 'first9'
  | 'doubleRate'
  | 'dartsToFinish'
  | 'highestCheckout'
  | 's80'
  | 's100'
  | 's120'
  | 's140'
  | 's160'
  | 's180'
  | 'mpr'
  | 'points'
  | 'dartsToWin'
  | 'fastestShanghai'
  | 'hitRate';

export interface MetricDef {
  key: MetricKey;
  label: string;
  better: 'higher' | 'lower';
  /** Steht erst am Ende fest; im Vergleich „nach gleich vielen Darts“ ohne Wert (SPEC 12). */
  endOnly?: boolean;
  /** Nachkommastellen für die Anzeige. */
  digits: number;
  unit?: string;
}

export const METRICS: Record<Mode, MetricDef[]> = {
  x01: [
    { key: 'avg', label: '3-Dart-Average', better: 'higher', digits: 2 },
    { key: 'first9', label: 'First-9-Average', better: 'higher', digits: 2 },
    { key: 'doubleRate', label: 'Double-Out-Quote', better: 'higher', digits: 1, unit: '%' },
    { key: 'dartsToFinish', label: 'Darts bis zum Finish', better: 'lower', endOnly: true, digits: 0 },
    { key: 'highestCheckout', label: 'Höchster Checkout', better: 'higher', endOnly: true, digits: 0 },
    { key: 's80', label: 'Aufnahmen 80–99', better: 'higher', digits: 0 },
    { key: 's100', label: 'Aufnahmen 100–119', better: 'higher', digits: 0 },
    { key: 's120', label: 'Aufnahmen 120–139', better: 'higher', digits: 0 },
    { key: 's140', label: 'Aufnahmen 140–159', better: 'higher', digits: 0 },
    { key: 's160', label: 'Aufnahmen 160–179', better: 'higher', digits: 0 },
    { key: 's180', label: 'Aufnahmen 180', better: 'higher', digits: 0 },
  ],
  cricket: [
    { key: 'mpr', label: 'Marks pro 3 Darts', better: 'higher', digits: 2 },
    { key: 'points', label: 'Gesamtpunkte', better: 'higher', digits: 0 },
    { key: 'dartsToWin', label: 'Darts bis zum Sieg', better: 'lower', endOnly: true, digits: 0 },
  ],
  shanghai: [
    { key: 'mpr', label: 'Marks pro 3 Darts', better: 'higher', digits: 2 },
    { key: 'fastestShanghai', label: 'Schnellstes Shanghai (Darts)', better: 'lower', endOnly: true, digits: 0 },
    { key: 'points', label: 'Endpunkte', better: 'higher', digits: 0 },
  ],
  doubles: [{ key: 'hitRate', label: 'Trefferquote', better: 'higher', digits: 1, unit: '%' }],
  countup: [
    { key: 'points', label: 'Endpunkte', better: 'higher', digits: 0 },
    { key: 'avg', label: '3-Dart-Average', better: 'higher', digits: 2 },
  ],
  atc: [
    { key: 'dartsToFinish', label: 'Darts bis zum Ende', better: 'lower', endOnly: true, digits: 0 },
    { key: 'hitRate', label: 'Trefferquote', better: 'higher', digits: 1, unit: '%' },
  ],
  bobs: [
    { key: 'points', label: 'Endpunkte', better: 'higher', digits: 0 },
    { key: 'hitRate', label: 'Trefferquote', better: 'higher', digits: 1, unit: '%' },
  ],
  halveit: [
    { key: 'points', label: 'Endpunkte', better: 'higher', digits: 0 },
    { key: 'hitRate', label: 'Trefferquote', better: 'higher', digits: 1, unit: '%' },
  ],
};

/** Ein Leg (bzw. Durchgang) eines Profils. */
export interface LegRecord {
  profileId: string;
  gameId: string;
  slot: number;
  mode: Mode;
  /** Vergleichsgruppe (SPEC 11.1): gleiche Einstellungen. */
  group: string;
  groupLabel: string;
  /** Zeitpunkt des Spielstarts. */
  ts: number;
  leg: number;
  /** Leg bzw. Durchgang abgeschlossen (nur dann zählt er für Bestleistungen). */
  complete: boolean;
  won: boolean;
  darts: number;
  values: Partial<Record<MetricKey, number>>;
  /** Bei Shanghai: Zielzahl des schnellsten Shanghai. */
  shanghaiField?: number;
  /** Doppelquote je Feld: aus X01 (Double-Versuche) bzw. aus dem Training. */
  doubles: DoubleTally;
  doublesSource?: 'x01' | 'training';
  /** Heatmap: Board-Darts je Feld (S20, T19, 0 …). */
  heat: Record<string, number>;
}

/** Vergleichsgruppe und ihr Name (SPEC 11.1). */
export function groupOf(game: GameInfo, slot: number): { group: string; label: string } {
  const c = game.created;
  switch (c.mode) {
    case 'x01': {
      const start = c.participants.find((p) => p.slot === slot)?.startScore ?? c.settings.startScore;
      const io = { single: 'S', double: 'D', master: 'M' };
      return {
        group: `x01|${start}|${c.settings.inMode}|${c.settings.outMode}`,
        label: `${start} · ${io[c.settings.inMode]}-In · ${io[c.settings.outMode]}-Out`,
      };
    }
    case 'cricket':
      return {
        group: `cricket|${[...c.settings.targets].sort((a, b) => a - b).join(',')}|${c.settings.closeAt}|${c.settings.variant}`,
        label: `Cricket ${c.settings.variant === 'cutthroat' ? 'Cut-Throat' : 'Standard'} · ${c.settings.targets.length} Zahlen · ${c.settings.closeAt}×`,
      };
    case 'shanghai':
      return {
        group: `shanghai|${c.settings.startNumber}|${c.settings.rounds}|${c.settings.endOnShanghai}`,
        label: `Shanghai ab ${c.settings.startNumber} · ${c.settings.rounds} Runden`,
      };
    case 'doubles': {
      const mode = c.settings.mode.kind === 'fixed' ? `fixed${c.settings.mode.darts}` : 'untilHit';
      const targets = targetsOf(c.settings).length;
      return {
        group: `doubles|${mode}|${targetsOf(c.settings).map((f) => f.n).join(',')}`,
        label: `Training · ${c.settings.mode.kind === 'fixed' ? `${c.settings.mode.darts} Darts/Feld` : 'bis Treffer'} · ${targets} Ziele`,
      };
    }
    case 'countup':
      return { group: `countup|${c.settings.rounds}`, label: `Count-Up · ${c.settings.rounds} Runden` };
    case 'atc':
      return {
        group: `atc|${c.settings.withBull}|${c.settings.ring}|${c.settings.ring === 'any' && c.settings.jumps}`,
        label: `Around the Clock${atcVariantLabel(c.settings)}`,
      };
    case 'bobs':
      return {
        group: `bobs|${c.settings.dieAtZero}`,
        label: `Bob's 27${c.settings.dieAtZero ? '' : ' · ohne Ausscheiden'}`,
      };
    case 'halveit': {
      const list = c.settings.targets.map(halveTargetName).join(', ');
      return {
        group: `halveit|${c.settings.targets.join(',')}|${c.settings.startPoints}`,
        label: `Halve-It · ${list}${c.settings.startPoints ? ` · Start ${c.settings.startPoints}` : ''}`,
      };
    }
  }
}

/** Board-Darts eines Spielers in einem Leg für die Heatmap (nur Eingaben über das Board). */
function heatOf(turns: readonly { slot: number; darts: { field: { n: number; m: number }; input: string; known: boolean }[] }[], slot: number) {
  const heat: Record<string, number> = {};
  for (const t of turns) {
    if (t.slot !== slot) continue;
    for (const d of t.darts) {
      if (d.input !== 'board' || !d.known) continue;
      const k = heatKey(d.field.n, d.field.m);
      heat[k] = (heat[k] ?? 0) + 1;
    }
  }
  return heat;
}

/** Alle Leg-Einträge aller Profile. Gäste und Computer bekommen keine (SPEC 6.2). Ausgeblendete Spiele fehlen. */
export function legRecords(events: readonly AppEvent[]): LegRecord[] {
  const out: LegRecord[] = [];
  for (const game of listGames(events)) {
    if (game.hidden || !game.orderDecided) continue;
    const computed = computeGame(game, events);
    for (const p of game.created.participants) {
      if (p.kind !== 'profile' || !p.profileId) continue;
      const { group, label } = groupOf(game, p.slot);
      const base = { profileId: p.profileId, gameId: game.created.gameId, slot: p.slot, group, groupLabel: label, ts: game.createdAt };

      if (computed.mode === 'x01') {
        const s = computed.state;
        for (const leg of s.legs) {
          const m = x01LegMetrics(leg, p.slot, s.setup.settings.outMode);
          if (!m.darts) continue;
          const values: LegRecord['values'] = {
            s80: m.s80,
            s100: m.s100,
            s120: m.s120,
            s140: m.s140,
            s160: m.s160,
            s180: m.s180,
          };
          if (m.avg !== null) values.avg = m.avg;
          if (m.first9 !== null) values.first9 = m.first9;
          if (m.doubleRate !== null) values.doubleRate = m.doubleRate;
          if (m.dartsToFinish !== null) values.dartsToFinish = m.dartsToFinish;
          if (m.highestCheckout !== null) values.highestCheckout = m.highestCheckout;
          out.push({
            ...base,
            mode: 'x01',
            leg: leg.leg,
            complete: leg.winner !== null,
            won: m.won,
            darts: m.darts,
            values,
            doubles: m.perDouble,
            doublesSource: 'x01',
            heat: heatOf(leg.turns, p.slot),
          });
        }
      } else if (computed.mode === 'cricket') {
        const s = computed.state;
        for (const leg of s.legs) {
          const m = cricketLegMetrics(leg, p.slot);
          if (!m.darts) continue;
          const values: LegRecord['values'] = {};
          if (m.mpr !== null) values.mpr = m.mpr;
          if (s.setup.settings.variant === 'standard') values.points = m.points;
          if (m.dartsToWin !== null) values.dartsToWin = m.dartsToWin;
          out.push({
            ...base,
            mode: 'cricket',
            leg: leg.leg,
            complete: leg.winners !== null,
            won: m.won,
            darts: m.darts,
            values,
            doubles: {},
            heat: heatOf(leg.turns, p.slot),
          });
        }
      } else if (computed.mode === 'shanghai') {
        const s = computed.state;
        const m = shanghaiMetrics(s, p.slot);
        if (!m.darts) continue;
        const values: LegRecord['values'] = { points: m.points };
        if (m.mpr !== null) values.mpr = m.mpr;
        if (m.fastestShanghai !== null) values.fastestShanghai = m.fastestShanghai;
        out.push({
          ...base,
          mode: 'shanghai',
          leg: 1,
          complete: s.finished,
          won: !!s.matchWinners?.includes(p.slot),
          darts: m.darts,
          values,
          ...(m.shanghaiField !== null ? { shanghaiField: m.shanghaiField } : {}),
          doubles: {},
          heat: heatOf(s.legs[0].turns, p.slot),
        });
      } else if (computed.mode === 'countup') {
        const s = computed.state;
        const m = countUpMetrics(s, p.slot);
        if (!m.darts) continue;
        const values: LegRecord['values'] = { points: m.points };
        if (m.avg !== null) values.avg = m.avg;
        out.push({
          ...base,
          mode: 'countup',
          leg: 1,
          complete: s.finished,
          won: !!s.matchWinners?.includes(p.slot),
          darts: m.darts,
          values,
          doubles: {},
          heat: heatOf(s.legs[0].turns, p.slot),
        });
      } else if (computed.mode === 'atc') {
        const s = computed.state;
        const m = atcMetrics(s, p.slot);
        if (!m.darts) continue;
        const values: LegRecord['values'] = {};
        if (m.hitRate !== null) values.hitRate = m.hitRate;
        if (m.dartsToFinish !== null) values.dartsToFinish = m.dartsToFinish;
        out.push({
          ...base,
          mode: 'atc',
          leg: 1,
          complete: s.finished,
          won: !!s.matchWinners?.includes(p.slot),
          darts: m.darts,
          values,
          doubles: {},
          heat: heatOf(s.legs[0].turns, p.slot),
        });
      } else if (computed.mode === 'bobs') {
        const s = computed.state;
        const m = bobsMetrics(s, p.slot);
        if (!m.darts) continue;
        const values: LegRecord['values'] = { points: m.points };
        if (m.hitRate !== null) values.hitRate = m.hitRate;
        out.push({
          ...base,
          mode: 'bobs',
          leg: 1,
          complete: s.finished,
          won: !!s.matchWinners?.includes(p.slot),
          darts: m.darts,
          values,
          // Bob's 27 zählt in die Doppelquote aus dem Training (SPEC 7.8, 11.6)
          doubles: m.perField,
          doublesSource: 'training',
          heat: {},
        });
      } else if (computed.mode === 'halveit') {
        const s = computed.state;
        const m = halveItMetrics(s, p.slot);
        if (!m.darts) continue;
        const values: LegRecord['values'] = { points: m.points };
        if (m.hitRate !== null) values.hitRate = m.hitRate;
        out.push({
          ...base,
          mode: 'halveit',
          leg: 1,
          complete: s.finished,
          won: !!s.matchWinners?.includes(p.slot),
          darts: m.darts,
          values,
          doubles: {},
          heat: heatOf(s.legs[0].turns, p.slot),
        });
      } else if (computed.mode === 'doubles') {
        const s = computed.state;
        const m = doublesMetrics(s, p.slot);
        if (!m.darts) continue;
        out.push({
          ...base,
          mode: 'doubles',
          leg: 1,
          complete: s.finished,
          won: !!s.matchWinners?.includes(p.slot),
          darts: m.darts,
          values: m.hitRate !== null ? { hitRate: m.hitRate } : {},
          doubles: m.perField,
          doublesSource: 'training',
          heat: {},
        });
      }
    }
  }
  return out;
}

// ---------- Auswertungen ----------

/** Verlauf einer Kennzahl: ein Punkt je Leg, dazu der gleitende Durchschnitt der letzten 10 Werte (SPEC 11.6). */
export function series(
  records: readonly LegRecord[],
  key: MetricKey,
  window = 10,
): { ts: number; value: number; moving: number; gameId: string; leg: number }[] {
  const points = records
    .filter((r) => r.values[key] !== undefined)
    .sort((a, b) => a.ts - b.ts || a.leg - b.leg)
    .map((r) => ({ ts: r.ts, value: r.values[key]!, gameId: r.gameId, leg: r.leg }));
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1);
    return { ...p, moving: slice.reduce((s, x) => s + x.value, 0) / slice.length };
  });
}

/** Heatmap: Anteil je Feld in Prozent aller Board-Darts (SPEC 11.6). */
export function heatmap(records: readonly LegRecord[]): { total: number; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of records) {
    for (const [k, v] of Object.entries(r.heat)) {
      counts[k] = (counts[k] ?? 0) + v;
      total += v;
    }
  }
  return { total, counts };
}

/** Doppelquote je Feld: aus dem Training, aus X01 und zusammen (SPEC 11.6). */
export function doubleRates(records: readonly LegRecord[]): Record<string, { training: { darts: number; hits: number }; x01: { darts: number; hits: number }; all: { darts: number; hits: number } }> {
  const training: DoubleTally = {};
  const x01: DoubleTally = {};
  for (const r of records) {
    const into = r.doublesSource === 'training' ? training : r.doublesSource === 'x01' ? x01 : null;
    if (!into) continue;
    for (const [k, v] of Object.entries(r.doubles)) {
      const t = (into[k] ??= { darts: 0, hits: 0 });
      t.darts += v.darts;
      t.hits += v.hits;
    }
  }
  const keys = [...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'DB'];
  const zero = { darts: 0, hits: 0 };
  return Object.fromEntries(
    keys.map((k) => {
      const tr = training[k] ?? zero;
      const xo = x01[k] ?? zero;
      return [k, { training: tr, x01: xo, all: { darts: tr.darts + xo.darts, hits: tr.hits + xo.hits } }];
    }),
  );
}

/** Rekord einer Kennzahl in einer Vergleichsgruppe; nur abgeschlossene Legs (SPEC 11.1, 12). */
export function bestRecord(records: readonly LegRecord[], def: MetricDef): LegRecord | null {
  let best: LegRecord | null = null;
  for (const r of records) {
    const v = r.values[def.key];
    if (!r.complete || v === undefined) continue;
    const b = best?.values[def.key];
    if (b === undefined || (def.better === 'higher' ? v > b : v < b)) best = r;
  }
  return best;
}

/** Abweichung in Prozent (SPEC 12): (aktuell − Rekord) / Rekord × 100; null ohne sinnvollen Rekord. */
export function deviation(current: number, record: number): number | null {
  return record === 0 ? null : ((current - record) / record) * 100;
}

// ---------- Bestleistungs-Vergleich (SPEC 12) ----------

/** Kennzahlen eines Legs aus den ersten `limit` Darts (für „Stand nach gleich vielen Darts“). */
export function metricsAt(
  events: readonly AppEvent[],
  gameId: string,
  slot: number,
  legNo: number,
  limit: number,
): Partial<Record<MetricKey, number>> {
  const game = listGames(events).find((g) => g.created.gameId === gameId);
  if (!game) return {};
  const c = computeGame(game, events);
  const v: Partial<Record<MetricKey, number>> = {};
  const put = (k: MetricKey, x: number | null) => {
    if (x !== null) v[k] = x;
  };
  if (c.mode === 'x01') {
    const leg = c.state.legs.find((l) => l.leg === legNo);
    if (!leg) return v;
    const m = x01LegMetrics(leg, slot, c.state.setup.settings.outMode, limit);
    put('avg', m.avg);
    put('first9', m.first9);
    put('doubleRate', m.doubleRate);
    for (const k of ['s80', 's100', 's120', 's140', 's160', 's180'] as const) v[k] = m[k];
  } else if (c.mode === 'cricket') {
    const leg = c.state.legs.find((l) => l.leg === legNo);
    if (!leg) return v;
    const m = cricketLegMetrics(leg, slot, limit);
    put('mpr', m.mpr);
    if (c.state.setup.settings.variant === 'standard') v.points = m.points;
  } else if (c.mode === 'shanghai') {
    const m = shanghaiMetrics(c.state, slot, limit);
    put('mpr', m.mpr);
    v.points = m.points;
  } else if (c.mode === 'countup') {
    const m = countUpMetrics(c.state, slot, limit);
    put('avg', m.avg);
    v.points = m.points;
  } else if (c.mode === 'atc') {
    put('hitRate', atcMetrics(c.state, slot, limit).hitRate);
  } else if (c.mode === 'bobs') {
    const m = bobsMetrics(c.state, slot, limit);
    put('hitRate', m.hitRate);
    v.points = m.points;
  } else if (c.mode === 'halveit') {
    const m = halveItMetrics(c.state, slot, limit);
    put('hitRate', m.hitRate);
    v.points = m.points;
  } else if (c.mode === 'doubles') {
    put('hitRate', doublesMetrics(c.state, slot, limit).hitRate);
  }
  return v;
}

export interface Comparison {
  def: MetricDef;
  /** Rekordwert (Endwert des Rekord-Legs) und woher er stammt. */
  record: { value: number; gameId: string; leg: number; ts: number; shanghaiField?: number } | null;
  /** Sicht 2: aktueller Wert gegen Rekord. */
  current: number | null;
  currentDeviation: number | null;
  /** Sicht 1: nach gleich vielen Darts – Wert des Rekord-Legs nach d Darts und des laufenden Legs. */
  sameDarts: { record: number | null; current: number | null; deviation: number | null } | null;
}

/**
 * Vergleich des laufenden Legs eines Profils mit seinen Rekorden in derselben Vergleichsgruppe (SPEC 12).
 * Das laufende Leg selbst zählt nicht als Rekord.
 */
export function compareWithBest(
  events: readonly AppEvent[],
  current: { profileId: string; gameId: string; slot: number; leg: number },
): { group: string; groupLabel: string; darts: number; rows: Comparison[] } | null {
  const all = legRecords(events);
  const me = all.find(
    (r) => r.profileId === current.profileId && r.gameId === current.gameId && r.leg === current.leg && r.slot === current.slot,
  );
  const game = listGames(events).find((g) => g.created.gameId === current.gameId);
  if (!game) return null;
  const { group, label } = groupOf(game, current.slot);
  const mode = game.created.mode as Mode;
  const pool = all.filter((r) => r.profileId === current.profileId && r.group === group && !(r.gameId === current.gameId && r.leg === current.leg));
  const d = me?.darts ?? 0;
  const nowAt = d ? metricsAt(events, current.gameId, current.slot, current.leg, d) : {};

  const rows = METRICS[mode].map((def): Comparison => {
    const rec = bestRecord(pool, def);
    const recordValue = rec?.values[def.key];
    const cur = me?.values[def.key] ?? null;
    let sameDarts: Comparison['sameDarts'] = null;
    if (!def.endOnly && rec && d) {
      const recAt = metricsAt(events, rec.gameId, rec.slot, rec.leg, d)[def.key] ?? null;
      const curAt = nowAt[def.key] ?? null;
      sameDarts = {
        record: recAt,
        current: curAt,
        deviation: recAt !== null && curAt !== null ? deviation(curAt, recAt) : null,
      };
    }
    return {
      def,
      record:
        rec && recordValue !== undefined
          ? { value: recordValue, gameId: rec.gameId, leg: rec.leg, ts: rec.ts, ...(rec.shanghaiField ? { shanghaiField: rec.shanghaiField } : {}) }
          : null,
      current: cur,
      currentDeviation: cur !== null && recordValue !== undefined ? deviation(cur, recordValue) : null,
      sameDarts,
    };
  });
  return { group, groupLabel: label, darts: d, rows };
}
