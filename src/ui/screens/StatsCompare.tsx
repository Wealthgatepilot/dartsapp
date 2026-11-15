// Vergleich in der Langzeitstatistik (SPEC 11.7): Spieler nebeneinander, direkter Vergleich, Zeiträume.

import { useState } from 'preact/hooks';
import { comparePeriods, comparePlayers, duels, type MetricSummary } from '../../engine/compare';
import type { AppEvent } from '../../engine/events';
import type { Mode } from '../../engine/metrics';
import type { Profile } from '../../engine/profiles';
import { series, type LegRecord, type MetricDef, type MetricKey } from '../../engine/records';
import { CompareChart } from '../charts';
import { Segmented } from '../components';
import { href } from '../router';
import { fmtMetric, remember } from './Stats';

const TABS = [
  { value: 'players', label: 'Spieler' },
  { value: 'duel', label: 'Direkt' },
  { value: 'periods', label: 'Zeiträume' },
] as const;
export type CompareTab = (typeof TABS)[number]['value'];

const WINDOWS = [
  { value: 7, label: '7 Tage' },
  { value: 30, label: '30 Tage' },
  { value: 90, label: '90 Tage' },
  { value: 365, label: '1 Jahr' },
];

const date = (ts: number) => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Schnitt mit mindestens einer Nachkommastelle, wie in der Übersicht. */
const fmtAvg = (def: MetricDef, s: MetricSummary) => fmtMetric({ ...def, digits: Math.max(def.digits, 1) }, s.avg);

export function StatsCompare({
  events,
  records,
  profiles,
  mode,
  since,
  withBots,
  defs,
  tab,
  onTab,
}: {
  events: readonly AppEvent[];
  /** Abgeschlossene Legs aller Profile im Modus, mit/ohne Computer gefiltert (ohne Zeitraum). */
  records: LegRecord[];
  profiles: Profile[];
  mode: Mode;
  since: number;
  withBots: boolean;
  defs: MetricDef[];
  /** Gewählter Reiter (gemerkt von der Statistik-Seite, die davon den Zeitraum-Filter abhängig macht). */
  tab: CompareTab;
  onTab: (t: CompareTab) => void;
}) {
  return (
    <>
      <Segmented label="Vergleich" value={tab} options={[...TABS]} onChange={onTab} />
      {tab === 'players' && <Players records={records.filter((r) => r.ts >= since)} profiles={profiles} defs={defs} />}
      {tab === 'duel' && <Duel events={events} records={records} profiles={profiles} mode={mode} since={since} withBots={withBots} defs={defs} />}
      {tab === 'periods' && <Periods records={records} profiles={profiles} defs={defs} />}
    </>
  );
}

/** Profile antippen; höchstens `max`. */
function PickProfiles({ profiles, picked, onChange, max }: { profiles: Profile[]; picked: string[]; onChange: (ids: string[]) => void; max: number }) {
  return (
    <div class="chips">
      {profiles.map((p) => {
        const on = picked.includes(p.profileId);
        return (
          <button
            key={p.profileId}
            class={on ? 'chip on' : 'chip'}
            aria-pressed={on}
            disabled={!on && picked.length >= max}
            onClick={() => onChange(on ? picked.filter((x) => x !== p.profileId) : [...picked, p.profileId])}
          >
            <span class="dot" style={{ background: p.color }} /> {p.name}
          </button>
        );
      })}
    </div>
  );
}

/** Gruppenauswahl wie in der Einzelansicht. */
function GroupSelect({ groups, value, onChange }: { groups: { group: string; label: string; count: number }[]; value: string | null; onChange: (g: string) => void }) {
  if (groups.length > 1) {
    return (
      <select class="select" value={value ?? undefined} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
        {groups.map((g) => (
          <option key={g.group} value={g.group}>
            {g.label} ({g.count})
          </option>
        ))}
      </select>
    );
  }
  return groups.length === 1 ? <span class="muted small">{groups[0].label}</span> : null;
}

// ---------- Spieler nebeneinander ----------

function Players({ records, profiles, defs }: { records: LegRecord[]; profiles: Profile[]; defs: MetricDef[] }) {
  const [saved, setPicked] = remember<string[]>('stats.comparePlayers', []);
  const [groupSel, setGroupSel] = useState<string | null>(null);
  const [metricSel, setMetricSel] = useState<MetricKey | null>(null);
  const valid = saved.filter((id) => profiles.some((p) => p.profileId === id));
  const picked = valid.length ? valid : profiles.slice(0, 2).map((p) => p.profileId);
  const c = comparePlayers(records, picked, defs, groupSel);
  const sel = picked.map((id) => profiles.find((p) => p.profileId === id)!);
  const metric = c.rows.find((r) => r.def.key === metricSel)?.def ?? c.rows[0]?.def;

  return (
    <>
      <PickProfiles profiles={profiles} picked={picked} onChange={setPicked} max={4} />
      {picked.length < 2 ? (
        <p class="muted">Mindestens zwei Spieler antippen.</p>
      ) : !c.group ? (
        <p class="muted">Keiner der Spieler hat abgeschlossene Spiele in diesem Modus und Zeitraum.</p>
      ) : (
        <>
          <div class="filters">
            <GroupSelect groups={c.groups} value={c.group} onChange={setGroupSel} />
          </div>
          <section class="card">
            <h2>Nebeneinander</h2>
            <div class="results-scroll">
              <table class="table compare-table">
                <thead>
                  <tr>
                    <th>Kennzahl</th>
                    {sel.map((p) => (
                      <th key={p.profileId}>
                        <span class="dot" style={{ background: p.color }} /> {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Legs</td>
                    {sel.map((p) => (
                      <td key={p.profileId}>{c.legs[p.profileId].length}</td>
                    ))}
                  </tr>
                  {c.rows.map((row) => (
                    <tr key={row.def.key}>
                      <td>{row.def.label}</td>
                      {sel.map((p) => {
                        const s = row.per[p.profileId];
                        return (
                          <td key={p.profileId} class={row.leaders.includes(p.profileId) ? 'compare-best' : undefined}>
                            {fmtAvg(row.def, s)}
                            {s.best !== null && <small> Rekord {fmtMetric(row.def, s.best)}</small>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="muted small">Schnitt je Leg im Zeitraum, darunter der Rekord. Hervorgehoben: der bessere Schnitt.</p>
          </section>
          {metric && (
            <section class="card">
              <h2>Verlauf</h2>
              <div class="chips">
                {c.rows.map((r) => (
                  <button key={r.def.key} class={r.def.key === metric.key ? 'chip chip-small on' : 'chip chip-small'} onClick={() => setMetricSel(r.def.key)}>
                    {r.def.label}
                  </button>
                ))}
              </div>
              <CompareChart
                series={sel.map((p) => ({ name: p.name, color: p.color, points: series(c.legs[p.profileId], metric.key) }))}
                digits={metric.digits}
                unit={metric.unit}
                label={metric.label}
              />
            </section>
          )}
        </>
      )}
    </>
  );
}

// ---------- Direkter Vergleich ----------

function Duel({
  events,
  records,
  profiles,
  mode,
  since,
  withBots,
  defs,
}: {
  events: readonly AppEvent[];
  records: LegRecord[];
  profiles: Profile[];
  mode: Mode;
  since: number;
  withBots: boolean;
  defs: MetricDef[];
}) {
  const [saved, setPicked] = remember<string[]>('stats.compareDuel', []);
  const valid = saved.filter((id) => profiles.some((p) => p.profileId === id)).slice(0, 2);
  const picked = valid.length === 2 ? valid : profiles.slice(0, 2).map((p) => p.profileId);
  const [a, b] = picked.map((id) => profiles.find((p) => p.profileId === id));
  const d = a && b ? duels(events, records, a.profileId, b.profileId, mode, defs, { since, withBots }) : null;
  const winnerName = (r: string) => (r === 'a' ? a!.name : r === 'b' ? b!.name : r === 'draw' ? 'Unentschieden' : 'ein anderer');

  return (
    <>
      <PickProfiles profiles={profiles} picked={picked} onChange={(ids) => setPicked(ids.slice(-2))} max={2} />
      {!a || !b ? (
        <p class="muted">Zwei Spieler antippen.</p>
      ) : !d || !d.duels.length ? (
        <p class="muted">
          {a.name} und {b.name} haben in diesem Modus und Zeitraum noch kein beendetes Spiel zusammen gespielt.
        </p>
      ) : (
        <>
          <section class="card">
            <h2>Bilanz</h2>
            <div class="duel-score">
              <span>
                <span class="dot" style={{ background: a.color }} /> {a.name}
              </span>
              <strong>
                {d.winsA} : {d.winsB}
              </strong>
              <span>
                {b.name} <span class="dot" style={{ background: b.color }} />
              </span>
            </div>
            <p class="muted small">
              {d.duels.length} {d.duels.length === 1 ? 'Spiel' : 'Spiele'} zusammen
              {d.draws ? ` · ${d.draws} unentschieden` : ''}
              {d.others ? ` · ${d.others}× hat ein anderer gewonnen` : ''}
              {d.legsA + d.legsB ? ` · Legs ${d.legsA} : ${d.legsB}` : ''}
            </p>
            {d.rows.length > 0 && (
              <table class="table compare-table">
                <thead>
                  <tr>
                    <th>In diesen Spielen</th>
                    <th>{a.name}</th>
                    <th>{b.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((row) => {
                    const aBetter = row.a.avg !== null && row.b.avg !== null && (row.def.better === 'higher' ? row.a.avg > row.b.avg : row.a.avg < row.b.avg);
                    const bBetter = row.a.avg !== null && row.b.avg !== null && (row.def.better === 'higher' ? row.b.avg > row.a.avg : row.b.avg < row.a.avg);
                    return (
                      <tr key={row.def.key}>
                        <td>{row.def.label}</td>
                        <td class={aBetter ? 'compare-best' : undefined}>{fmtAvg(row.def, row.a)}</td>
                        <td class={bBetter ? 'compare-best' : undefined}>{fmtAvg(row.def, row.b)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
          <section class="card">
            <h2>Letzte Duelle</h2>
            <ul class="list">
              {d.duels.slice(0, 5).map((x) => (
                <li key={x.gameId} class="list-row">
                  <a href={href({ name: 'review', gameId: x.gameId })}>
                    {date(x.ts)} · {x.result === 'draw' || x.result === 'other' ? winnerName(x.result) : `🏆 ${winnerName(x.result)}`}
                    {x.legsA + x.legsB ? ` · ${x.legsA} : ${x.legsB}` : ''}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}

// ---------- Zeiträume ----------

function Periods({ records, profiles, defs }: { records: LegRecord[]; profiles: Profile[]; defs: MetricDef[] }) {
  const [profileId, setProfileId] = remember<string | null>('stats.profile', null);
  const [days, setDays] = remember<number>('stats.compareWindow', 30);
  const [groupSel, setGroupSel] = useState<string | null>(null);
  const profile = profiles.find((p) => p.profileId === profileId) ?? profiles[0];
  const now = Date.now();
  // Gruppen des Spielers in beiden Fenstern, meistgespielte zuerst
  const mine = records.filter((r) => r.profileId === profile.profileId && r.ts >= now - 2 * days * 86_400_000);
  const groups = comparePlayers(mine, [profile.profileId], []).groups;
  const group = groups.find((g) => g.group === groupSel)?.group ?? groups[0]?.group ?? null;
  const rows = comparePeriods(
    mine.filter((r) => r.group === group),
    defs,
    days,
    now,
  );

  return (
    <>
      <div class="chips">
        {profiles.map((p) => (
          <button key={p.profileId} class={p.profileId === profile.profileId ? 'chip on' : 'chip'} onClick={() => setProfileId(p.profileId)}>
            <span class="dot" style={{ background: p.color }} /> {p.name}
          </button>
        ))}
      </div>
      <div class="filters">
        <Segmented label="Zeitfenster" value={days} options={WINDOWS} onChange={setDays} />
        <GroupSelect groups={groups} value={group} onChange={setGroupSel} />
      </div>
      {!rows.length ? (
        <p class="muted">Keine abgeschlossenen Spiele in den letzten {days * 2} Tagen.</p>
      ) : (
        <section class="card">
          <h2>Letzte {days} Tage gegen die {days} Tage davor</h2>
          <table class="table compare-table">
            <thead>
              <tr>
                <th>Kennzahl</th>
                <th>Vorher</th>
                <th>Jetzt</th>
                <th>Veränderung</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.def.key}>
                  <td>{row.def.label}</td>
                  <td>{fmtAvg(row.def, row.before)}</td>
                  <td>{fmtAvg(row.def, row.now)}</td>
                  <td class={row.improved === true ? 'delta-good' : row.improved === false ? 'delta-bad' : undefined}>
                    {row.delta === null
                      ? '—'
                      : `${row.delta > 0 ? '+' : row.delta < 0 ? '−' : '±'}${fmtMetric({ ...row.def, digits: Math.max(row.def.digits, 1) }, Math.abs(row.delta))}`}
                    {row.improved === true ? ' ▲' : row.improved === false ? ' ▼' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="muted small">
            Schnitt je Leg. Grün ▲ = besser, rot ▼ = schlechter (bei „Darts bis …“ ist weniger besser). Legs: vorher{' '}
            {rows[0].before.count}, jetzt {rows[0].now.count}.
          </p>
        </section>
      )}
    </>
  );
}
