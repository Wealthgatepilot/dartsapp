// Langzeitstatistik je Profil und Modus (SPEC 11.6): Übersicht, Verlauf, Heatmap, Doppelquote je Feld.

import { useMemo, useState } from 'preact/hooks';
import type { Mode } from '../../engine/metrics';
import { listProfiles } from '../../engine/profiles';
import {
  METRICS,
  bestRecord,
  doubleRates,
  heatmap,
  legRecords,
  series,
  type LegRecord,
  type MetricDef,
  type MetricKey,
} from '../../engine/records';
import { HeatBoard, TrendChart } from '../charts';
import { Segmented, TopBar } from '../components';
import { useAppData } from '../data';
import { href } from '../router';

const MODES: { value: Mode; label: string }[] = [
  { value: 'x01', label: 'X01' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'shanghai', label: 'Shanghai' },
  { value: 'doubles', label: 'Training' },
];

const PERIODS = [
  { value: 30, label: '30 Tage' },
  { value: 90, label: '90 Tage' },
  { value: 365, label: '1 Jahr' },
  { value: 0, label: 'alles' },
];
const DAY = 86_400_000;

/** Kleine Merkhilfe pro Gerät (Browser-Speicher, nur Bequemlichkeit). */
function remember<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : fallback;
    } catch {
      return fallback;
    }
  });
  return [
    v,
    (x: T) => {
      setV(x);
      try {
        localStorage.setItem(key, JSON.stringify(x));
      } catch {
        // ohne Browser-Speicher wird es eben nicht gemerkt
      }
    },
  ];
}

export function fmtMetric(def: MetricDef, v: number | undefined | null): string {
  if (v === undefined || v === null) return '—';
  const s = v.toLocaleString('de-DE', { minimumFractionDigits: def.digits, maximumFractionDigits: def.digits });
  return def.unit ? `${s} ${def.unit}` : s;
}

export function Stats() {
  const { events } = useAppData();
  const profiles = useMemo(() => listProfiles(events).filter((p) => !p.archived), [events]);
  const all = useMemo(() => legRecords(events), [events]);

  const [profileId, setProfileId] = remember<string | null>('stats.profile', null);
  const [mode, setMode] = remember<Mode>('stats.mode', 'x01');
  const [period, setPeriod] = remember<number>('stats.period', 0);
  const [groupSel, setGroupSel] = useState<string | null>(null);
  const [metricSel, setMetricSel] = useState<MetricKey | null>(null);

  const profile = profiles.find((p) => p.profileId === profileId) ?? profiles[0];
  const since = period ? Date.now() - period * DAY : 0;
  const mine = all.filter((r) => r.profileId === profile?.profileId && r.ts >= since);
  const inMode = mine.filter((r) => r.mode === mode);
  // Übersicht und Verlauf: nur abgeschlossene Legs (ein abgebrochenes Leg mit einem Dart verzerrt sonst den Average).
  const complete = inMode.filter((r) => r.complete);

  // Vergleichsgruppen mit Anzahl; Standard = die meistgespielte
  const groups = [...new Map(complete.map((r) => [r.group, r.groupLabel])).entries()]
    .map(([group, label]) => ({ group, label, count: complete.filter((r) => r.group === group).length }))
    .sort((a, b) => b.count - a.count);
  const group = groups.find((g) => g.group === groupSel)?.group ?? groups[0]?.group;
  const records = complete.filter((r) => r.group === group);
  const defs = METRICS[mode];
  const metric = defs.find((d) => d.key === metricSel) ?? defs[0];

  if (!profiles.length) {
    return (
      <div class="page">
        <TopBar title="Statistik" back={href({ name: 'home' })} />
        <p>
          Statistik gibt es für Profile. <a href={href({ name: 'profiles' })}>Profil anlegen</a>
        </p>
      </div>
    );
  }

  return (
    <div class="page">
      <TopBar title="Statistik" back={href({ name: 'home' })} />

      <div class="chips">
        {profiles.map((p) => (
          <button
            key={p.profileId}
            class={p.profileId === profile.profileId ? 'chip on' : 'chip'}
            onClick={() => setProfileId(p.profileId)}
          >
            <span class="dot" style={{ background: p.color }} /> {p.name}
          </button>
        ))}
      </div>

      <div class="filters">
        <Segmented value={mode} options={MODES} onChange={(m) => (setMode(m), setGroupSel(null), setMetricSel(null))} />
        <Segmented value={period} options={PERIODS} onChange={setPeriod} />
        {groups.length > 1 && (
          <select class="select" value={group} onChange={(e) => setGroupSel((e.target as HTMLSelectElement).value)}>
            {groups.map((g) => (
              <option key={g.group} value={g.group}>
                {g.label} ({g.count})
              </option>
            ))}
          </select>
        )}
        {groups.length === 1 && <span class="muted small">{groups[0].label}</span>}
      </div>

      {!records.length ? (
        <p class="muted">Noch keine abgeschlossenen Spiele in diesem Modus und Zeitraum.</p>
      ) : (
        <>
          <Overview records={records} defs={defs} />

          <section class="card">
            <h2>Verlauf</h2>
            <div class="chips">
              {defs
                .filter((d) => records.some((r) => r.values[d.key] !== undefined))
                .map((d) => (
                  <button key={d.key} class={d.key === metric.key ? 'chip chip-small on' : 'chip chip-small'} onClick={() => setMetricSel(d.key)}>
                    {d.label}
                  </button>
                ))}
            </div>
            <TrendChart points={series(records, metric.key)} digits={metric.digits} unit={metric.unit} label={metric.label} />
          </section>
        </>
      )}

      {mode !== 'doubles' && inMode.length > 0 && (
        <section class="card">
          <h2>Treffer-Heatmap</h2>
          <p class="muted small">Alle {MODES.find((m) => m.value === mode)!.label}-Spiele im Zeitraum, nur Eingaben über das Board.</p>
          <HeatBoard {...heatmap(inMode)} />
        </section>
      )}

      {(mode === 'x01' || mode === 'doubles') && (
        <DoubleTable records={mine.filter((r) => r.doublesSource)} />
      )}
    </div>
  );
}

/** Je Kennzahl: letzter Wert, Schnitt im Zeitraum, Rekord (nur abgeschlossene Legs). */
function Overview({ records, defs }: { records: LegRecord[]; defs: MetricDef[] }) {
  const sorted = [...records].sort((a, b) => a.ts - b.ts || a.leg - b.leg);
  return (
    <section class="card">
      <h2>Übersicht</h2>
      <p class="muted small">
        {records.length} abgeschlossene {records.length === 1 ? 'Leg' : 'Legs'}, davon {records.filter((r) => r.won).length} gewonnen
      </p>
      <table class="table">
        <thead>
          <tr>
            <th>Kennzahl</th>
            <th>Letzter</th>
            <th>Schnitt</th>
            <th>Rekord</th>
          </tr>
        </thead>
        <tbody>
          {defs.map((d) => {
            const vals = sorted.map((r) => r.values[d.key]).filter((v): v is number => v !== undefined);
            if (!vals.length) return null;
            const best = bestRecord(records, d);
            return (
              <tr key={d.key}>
                <td>{d.label}</td>
                <td>{fmtMetric(d, vals[vals.length - 1])}</td>
                {/* Schnitt von Zählwerten mit einer Nachkommastelle, sonst wird 0,5 zu „1“ */}
                <td>{fmtMetric({ ...d, digits: Math.max(d.digits, 1) }, vals.reduce((s, v) => s + v, 0) / vals.length)}</td>
                <td>
                  {fmtMetric(d, best?.values[d.key])}
                  {d.key === 'fastestShanghai' && best?.shanghaiField ? ` (${best.shanghaiField})` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/** Doppelquote je Feld aus Training und X01 (SPEC 11.6). */
function DoubleTable({ records }: { records: LegRecord[] }) {
  const rates = doubleRates(records);
  const rows = Object.entries(rates).filter(([, v]) => v.all.darts > 0);
  const cell = (v: { darts: number; hits: number }) =>
    v.darts ? `${v.hits}/${v.darts} · ${((100 * v.hits) / v.darts).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %` : '—';
  return (
    <section class="card">
      <h2>Doppelquote je Feld</h2>
      {!rows.length ? (
        <p class="muted">Noch keine Würfe auf Doubles im Zeitraum.</p>
      ) : (
        <div class="results-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Feld</th>
                <th>Training</th>
                <th>X01</th>
                <th>Zusammen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{cell(v.training)}</td>
                  <td>{cell(v.x01)}</td>
                  <td>
                    <strong>{cell(v.all)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p class="muted small">X01: ein Versuch ist jeder Dart bei einem Rest, der mit einem Dart auf ein Double checkbar ist.</p>
    </section>
  );
}
