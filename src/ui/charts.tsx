// Diagramme der Statistik (SPEC 11.6): Verlauf einer Kennzahl und Heatmap auf dem Board.
// Gestaltung nach den Diagramm-Richtlinien: dünne Linien, Punkte ≥ 8 px mit Ring in Flächenfarbe,
// zurückhaltende Gitterlinien, Text in Textfarben, Antippen zeigt den Wert, Tabelle als Alternative.

import { useState } from 'preact/hooks';
import { BOARD_ORDER } from '../engine/types';

const fmt = (v: number, digits: number, unit = '') =>
  `${v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`;
const date = (ts: number) => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Saubere Achsenwerte (1, 2, 5 × 10ⁿ). */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= max + step * 0.001; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export interface SeriesPoint {
  ts: number;
  value: number;
  moving: number;
}

/** Verlauf: ein Punkt je Leg, Linie = gleitender Durchschnitt der letzten 10. */
export function TrendChart({
  points,
  digits,
  unit,
  label,
}: {
  points: SeriesPoint[];
  digits: number;
  unit?: string;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  if (!points.length) return <p class="muted">Noch keine Werte.</p>;

  const W = 340;
  const H = 190;
  const L = 44;
  const R = 10;
  const T = 10;
  const B = 24;
  const values = points.flatMap((p) => [p.value, p.moving]);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const x = (i: number) => (points.length === 1 ? (L + W - R) / 2 : L + (i / (points.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.moving).toFixed(1)}`).join(' ');
  const shown = active ?? points.length - 1;
  const p = points[shown];

  // Antippen/Überfahren: nächster Punkt nach x
  const pick = (e: PointerEvent) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setActive(best);
  };

  return (
    <div class="chart">
      <div class="chart-info">
        <span>
          <strong>{fmt(p.value, digits, unit)}</strong> <span class="muted">am {date(p.ts)}</span>
        </span>
        <span class="muted">Schnitt {fmt(p.moving, digits, unit)}</span>
      </div>
      {table ? (
        <div class="results-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>{label}</th>
                <th>Schnitt (10)</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((q, i) => (
                <tr key={i}>
                  <td>{date(q.ts)}</td>
                  <td>{fmt(q.value, digits, unit)}</td>
                  <td>{fmt(q.moving, digits, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          class="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          onPointerDown={pick}
          onPointerMove={pick}
          role="img"
          aria-label={`Verlauf ${label}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} class="chart-grid" />
              <text x={L - 6} y={y(t)} class="chart-tick" text-anchor="end" dominant-baseline="central">
                {fmt(t, t % 1 === 0 ? 0 : digits)}
              </text>
            </g>
          ))}
          <text x={L} y={H - 6} class="chart-tick">
            {date(points[0].ts)}
          </text>
          {points.length > 1 && (
            <text x={W - R} y={H - 6} class="chart-tick" text-anchor="end">
              {date(points[points.length - 1].ts)}
            </text>
          )}
          {points.map((q, i) => (
            <circle key={i} cx={x(i)} cy={y(q.value)} r={i === shown ? 6 : 4} class="chart-dot" />
          ))}
          {points.length > 1 && <path d={line} class="chart-line" />}
          <line x1={x(shown)} x2={x(shown)} y1={T} y2={H - B} class="chart-cross" />
        </svg>
      )}
      <div class="chart-legend">
        <span>
          <span class="key-dot" /> je Leg
        </span>
        <span>
          <span class="key-line" /> Schnitt der letzten 10
        </span>
        <button class="btn btn-small" onClick={() => setTable(!table)}>
          {table ? 'Diagramm' : 'Tabelle'}
        </button>
      </div>
    </div>
  );
}

// ---------- Heatmap ----------

/** Wärmebild (Wunsch Gianluca): selten = blau, mittel = weiß, oft = rot. Felder ohne Darts bleiben dunkel. */
const RAMP = ['#184f95', '#2a78d6', '#5598e7', '#9ec5f4', '#d6e6fa', '#f5f5f5', '#fad4d3', '#f4918f', '#e66767', '#d43633', '#a92c2a'];

function polar(r: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  return `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
}
function ring(r0: number, r1: number, a0: number, a1: number): string {
  return `M ${polar(r0, a0)} L ${polar(r1, a0)} A ${r1} ${r1} 0 0 1 ${polar(r1, a1)} L ${polar(r0, a1)} A ${r0} ${r0} 0 0 0 ${polar(r0, a0)} Z`;
}

/** Anteil je Feld (S20, D16, T19, SB, DB, 0) als Farbe auf dem Board; Antippen zeigt Anteil und Anzahl. */
export function HeatBoard({ counts, total }: { counts: Record<string, number>; total: number }) {
  const [sel, setSel] = useState<string | null>(null);
  if (!total) return <p class="muted">Noch keine Darts über das Board.</p>;
  const max = Math.max(...Object.values(counts));
  const fill = (key: string) => {
    const c = counts[key] ?? 0;
    if (!c) return '#2a3138';
    return RAMP[Math.min(RAMP.length - 1, Math.floor((c / max) * (RAMP.length - 1)))];
  };
  const share = (key: string) =>
    `${((100 * (counts[key] ?? 0)) / total).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
  const name = (key: string) => (key === '0' ? 'Daneben' : key === 'SB' ? 'Single-Bull' : key === 'DB' ? 'Bullseye' : key);
  const seg = (key: string, d: string) => (
    <path
      d={d}
      fill={fill(key)}
      stroke="#14181c"
      stroke-width="0.6"
      class={sel === key ? 'heat-sel' : ''}
      onClick={() => setSel(key)}
    />
  );
  return (
    <div class="heat">
      <div class="chart-info">
        {sel ? (
          <span>
            <strong>{name(sel)}</strong>: {share(sel)} <span class="muted">({counts[sel] ?? 0} von {total} Darts)</span>
          </span>
        ) : (
          <span class="muted">Feld antippen für Anteil und Anzahl · {total} Darts</span>
        )}
      </div>
      <svg viewBox="-100 -100 200 200" class="heat-svg" role="img" aria-label="Treffer-Heatmap">
        <circle r="100" fill={fill('0')} onClick={() => setSel('0')} class={sel === '0' ? 'heat-sel' : ''} />
        {BOARD_ORDER.map((n, i) => {
          const a0 = i * 18 - 9;
          const a1 = i * 18 + 9;
          return (
            <g key={n}>
              {seg(`S${n}`, ring(16, 46, a0, a1))}
              {seg(`T${n}`, ring(46, 54, a0, a1))}
              {seg(`S${n}`, ring(54, 76, a0, a1))}
              {seg(`D${n}`, ring(76, 84, a0, a1))}
            </g>
          );
        })}
        <circle r="16" fill={fill('SB')} onClick={() => setSel('SB')} class={sel === 'SB' ? 'heat-sel' : ''} />
        <circle r="7" fill={fill('DB')} onClick={() => setSel('DB')} class={sel === 'DB' ? 'heat-sel' : ''} />
        {BOARD_ORDER.map((n, i) => {
          const [lx, ly] = polar(92, i * 18).split(' ');
          return (
            <text key={`l${n}`} x={lx} y={ly} class="b-label" text-anchor="middle" dominant-baseline="central">
              {n}
            </text>
          );
        })}
      </svg>
      <div class="heat-scale">
        <span class="muted">selten</span>
        <span class="heat-ramp" style={{ background: `linear-gradient(90deg, ${RAMP.join(',')})` }} />
        <span class="muted">oft</span>
      </div>
    </div>
  );
}
