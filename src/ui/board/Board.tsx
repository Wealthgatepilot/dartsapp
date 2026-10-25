// Board-Eingabe nach SPEC 4.2 und 4.3: Finger aufsetzen wählt die Zahl,
// Ziehen in Richtung der Ring-Leiste wählt S/D/T, Loslassen trägt ein.

import { useRef, useState } from 'preact/hooks';
import { BOARD_ORDER, BULL, MISS, type Field, type Multiplier } from '../../engine/types';
import {
  BULL_ZONE,
  NUMBER_ZONE,
  dragTowardsBar,
  placeBar,
  stepFromDrag,
  zoneAt,
  type BarLayout,
} from './geometry';

export type Preview = { field: Field } | { cancel: true } | null;

interface Props {
  onDart: (field: Field) => void;
  onPreview?: (preview: Preview) => void;
  /** Zugweite pro Stufe in Pixeln (SPEC 4.3: 50). */
  stepPx?: number;
}

interface Active {
  pointerId: number;
  kind: 'bull' | 'number' | 'miss';
  n: number;
  startX: number;
  startY: number;
  bar: BarLayout | null;
  step: number;
}

// Radien der gezeichneten Ringe (Board-Radius = 100). Stilisiert, nicht maßstäblich:
// Die Trefferzonen entscheiden nur über die Zahl, der Ring kommt aus der Leiste.
const R_BULL = BULL_ZONE * 100;
const R_BULLSEYE = 7;
const R_TRIPLE_IN = 46;
const R_TRIPLE_OUT = 54;
const R_DOUBLE_IN = 76;
const R_NUMBERS = NUMBER_ZONE * 100;

function point(r: number, deg: number): string {
  const rad = (deg * Math.PI) / 180;
  return `${(r * Math.sin(rad)).toFixed(3)} ${(-r * Math.cos(rad)).toFixed(3)}`;
}

/** Ringstück zwischen zwei Radien und zwei Winkeln (0° = oben, im Uhrzeigersinn). */
function sector(r0: number, r1: number, a0: number, a1: number): string {
  return [
    `M ${point(r0, a0)}`,
    `L ${point(r1, a0)}`,
    `A ${r1} ${r1} 0 0 1 ${point(r1, a1)}`,
    `L ${point(r0, a1)}`,
    `A ${r0} ${r0} 0 0 0 ${point(r0, a0)}`,
    'Z',
  ].join(' ');
}

function itemsFor(kind: 'bull' | 'number', n: number): { label: string; field: Field }[] {
  if (kind === 'bull') {
    return [
      { label: '25', field: { n: BULL, m: 1 } },
      { label: '50', field: { n: BULL, m: 2 } },
    ];
  }
  return (['S', 'D', 'T'] as const).map((p, i) => ({
    label: `${p}${n}`,
    field: { n, m: (i + 1) as Multiplier },
  }));
}

export function Board({ onDart, onPreview, stepPx = 50 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<Active | null>(null);
  const activeRef = useRef<Active | null>(null);

  const update = (next: Active | null) => {
    activeRef.current = next;
    setActive(next);
    if (!onPreview) return;
    if (!next) onPreview(null);
    else if (next.kind === 'miss') onPreview({ field: MISS });
    else if (next.step < 0) onPreview({ cancel: true });
    else onPreview({ field: itemsFor(next.kind, next.n)[next.step].field });
  };

  const onPointerDown = (e: PointerEvent) => {
    if (activeRef.current) return; // zweiter Finger wird ignoriert
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const radius = rect.width / 2;
    const zone = zoneAt(e.clientX - (rect.left + radius), e.clientY - (rect.top + radius), radius);
    if (zone.kind === 'outside') return;
    e.preventDefault();
    try {
      svg.setPointerCapture(e.pointerId); // Finger darf beim Ziehen das Board verlassen
    } catch {
      // ohne Capture geht es auch, nur Ziehen über den Rand hinaus endet dann früher
    }

    const n = zone.kind === 'number' ? zone.n : zone.kind === 'bull' ? BULL : 0;
    const bar =
      zone.kind === 'miss'
        ? null
        : placeBar(e.clientX, e.clientY, zone.kind === 'bull' ? 2 : 3, window.innerWidth, window.innerHeight);
    update({ pointerId: e.pointerId, kind: zone.kind, n, startX: e.clientX, startY: e.clientY, bar, step: 0 });
  };

  const onPointerMove = (e: PointerEvent) => {
    const a = activeRef.current;
    if (!a || e.pointerId !== a.pointerId || !a.bar) return;
    const items = a.kind === 'bull' ? 2 : 3;
    const distance = dragTowardsBar(a.bar.direction, e.clientX - a.startX, e.clientY - a.startY);
    const step = stepFromDrag(distance, items, stepPx);
    if (step !== a.step) {
      navigator.vibrate?.(8);
      update({ ...a, step });
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    const a = activeRef.current;
    if (!a || e.pointerId !== a.pointerId) return;
    update(null);
    if (a.kind === 'miss') onDart(MISS);
    else if (a.step >= 0) onDart(itemsFor(a.kind, a.n)[a.step].field);
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (activeRef.current?.pointerId === e.pointerId) update(null);
  };

  const highlightIndex = active?.kind === 'number' ? BOARD_ORDER.indexOf(active.n as never) : -1;

  return (
    <>
      <svg
        ref={svgRef}
        class="board"
        viewBox="-100 -100 200 200"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Dartboard zur Eingabe"
      >
        <circle r="100" class={active?.kind === 'miss' ? 'b-miss b-miss-active' : 'b-miss'} />
        {BOARD_ORDER.map((n, i) => {
          const a0 = i * 18 - 9;
          const a1 = i * 18 + 9;
          const dark = i % 2 === 0;
          const single = dark ? 'b-single-dark' : 'b-single-light';
          const ring = dark ? 'b-ring-red' : 'b-ring-green';
          return (
            <g key={n} data-n={n}>
              <path d={sector(R_BULL, R_TRIPLE_IN, a0, a1)} class={single} />
              <path d={sector(R_TRIPLE_IN, R_TRIPLE_OUT, a0, a1)} class={ring} />
              <path d={sector(R_TRIPLE_OUT, R_DOUBLE_IN, a0, a1)} class={single} />
              <path d={sector(R_DOUBLE_IN, R_NUMBERS, a0, a1)} class={ring} />
            </g>
          );
        })}
        {highlightIndex >= 0 && (
          <path
            d={sector(R_BULL, R_NUMBERS, highlightIndex * 18 - 9, highlightIndex * 18 + 9)}
            class="b-highlight"
          />
        )}
        <circle r={R_BULL} class="b-ring-green" />
        <circle r={R_BULLSEYE} class="b-ring-red" />
        {active?.kind === 'bull' && <circle r={R_BULL} class="b-highlight" />}
        {BOARD_ORDER.map((n, i) => {
          const [x, y] = point((R_NUMBERS + 100) / 2, i * 18).split(' ');
          return (
            <text
              key={`l${n}`}
              x={x}
              y={y}
              class={i === highlightIndex ? 'b-label b-label-active' : 'b-label'}
              text-anchor="middle"
              dominant-baseline="central"
            >
              {n}
            </text>
          );
        })}
      </svg>
      {active?.bar && <RingBar active={active} bar={active.bar} />}
    </>
  );
}

function RingBar({ active, bar }: { active: Active; bar: BarLayout }) {
  const items = itemsFor(active.kind as 'bull' | 'number', active.n);
  // Das erste Feld (S bzw. 25) liegt immer am nächsten zum Finger.
  const flow = bar.direction === 'up' ? 'column-reverse' : bar.direction === 'left' ? 'row-reverse' : 'row';
  return (
    <div
      class={active.step < 0 ? 'ringbar ringbar-cancel' : 'ringbar'}
      style={{ left: `${bar.x}px`, top: `${bar.y}px`, width: `${bar.width}px`, height: `${bar.height}px`, flexDirection: flow }}
    >
      {items.map((it, i) => (
        <div key={it.label} class={`ringbar-item m${it.field.m}${i === active.step ? ' selected' : ''}`}>
          {it.label}
        </div>
      ))}
    </div>
  );
}
