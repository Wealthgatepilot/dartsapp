// Wer beginnt (SPEC 6.3, 6.4): Ausbullen mit vergrößertem Bull und Lupe, oder Münzwurf.
// Am Ende steht game.orderDecided; danach beginnt das Spiel.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  BULLSEYE_R,
  SINGLE_BULL_R,
  coinOrder,
  computeBulloff,
  cryptoRandom,
  distanceLabel,
  distanceMm,
} from '../../engine/bulloff';
import { BOT_DELAY_MS, BOT_SIGMA, BOT_SIGMA_HUMAN, aimPoint, gaussian } from '../../engine/bot';
import type { GameEvent, NewAppEvent } from '../../engine/events';
import type { GameInfo } from '../../engine/games';
import { BULL } from '../../engine/types';
import { TopBar } from '../components';
import { useAppData } from '../data';
import { href, navigate } from '../router';

interface Props {
  game: GameInfo;
  gameEvents: GameEvent[];
  nameOf: (slot: number) => string;
  colorOf: (slot: number) => string;
}

export function StartOrder(p: Props) {
  const { append } = useAppData();
  const gameId = p.game.created.gameId;
  const abandon = async () => {
    if (!confirm('Spiel abbrechen?')) return;
    await append([{ type: 'game.ended', payload: { gameId, reason: 'abandoned' } }]);
    navigate({ name: 'home' }, true);
  };
  return (
    <div class="page start-order">
      <TopBar
        title="Wer wirft zuerst?"
        back={href({ name: 'home' })}
        right={
          <button class="btn btn-small" onClick={abandon}>
            Abbrechen
          </button>
        }
      />
      {p.game.created.start === 'coin' ? <Coin {...p} /> : <Bulloff {...p} />}
    </div>
  );
}

// ---------- Münzwurf ----------

function Coin({ game, nameOf }: Props) {
  const { append } = useAppData();
  const slots = game.created.participants.map((x) => x.slot);
  const [order, setOrder] = useState<number[] | null>(null);
  return (
    <section class="card coin">
      {!order ? (
        <>
          <p>{slots.length === 2 ? 'Die Münze entscheidet, wer beginnt.' : 'Der Zufall legt die Reihenfolge fest.'}</p>
          <button class="btn btn-primary btn-wide" onClick={() => setOrder(coinOrder(slots, cryptoRandom))}>
            🪙 Münze werfen
          </button>
        </>
      ) : (
        <>
          <p class="coin-result">
            <strong>{nameOf(order[0])}</strong> beginnt
          </p>
          {order.length > 2 && (
            <ol class="ranking">
              {order.map((s) => (
                <li key={s}>{nameOf(s)}</li>
              ))}
            </ol>
          )}
          <div class="row">
            <button class="btn" onClick={() => setOrder(coinOrder(slots, cryptoRandom))}>
              Nochmal werfen
            </button>
            <button
              class="btn btn-primary grow"
              onClick={() =>
                append([{ type: 'game.orderDecided', payload: { gameId: game.created.gameId, order, method: 'coin' } }])
              }
            >
              Spiel anfangen
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- Ausbullen ----------

/** Ausschnitt um das Bull in mm (SPEC 6.4: etwa ±45 mm). */
const VIEW = 45;
const LOUPE = 9;
/** Stärkste Vergrößerung: ±6 mm sichtbar (etwa das Bull mit etwas Rand). */
const MIN_HALF = 6;
/** Ganz herausgezoomt: das ganze Board mit Zahlenring (Radius 190 mm). */
const MAX_HALF = 190;

function Bulloff({ game, gameEvents, nameOf, colorOf }: Props) {
  const { append } = useAppData();
  const gameId = game.created.gameId;
  const slots = game.created.participants.map((x) => x.slot);
  const state = useMemo(() => computeBulloff(slots, gameId, gameEvents), [gameEvents]);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [touch, setTouch] = useState<{ cx: number; cy: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const act = async (evs: NewAppEvent[]) => {
    if (busy || !evs.length) return;
    setBusy(true);
    try {
      await append(evs);
    } finally {
      setBusy(false);
    }
  };

  // ---- Eigener Zoom (SPEC 6.4, Punkt 2): Der Browser-Zoom ist in der App aus, hier vergrößert die App selbst. ----
  // Sichtbarer Ausschnitt: Mitte (cx, cy) und halbe Kantenlänge in mm.
  const [view, setView] = useState({ cx: 0, cy: 0, half: VIEW });
  const viewRef = useRef(view);
  viewRef.current = view;
  const setZoom = (half: number, cx: number, cy: number) => {
    const h = Math.max(MIN_HALF, Math.min(MAX_HALF, half));
    const lim = MAX_HALF - h; // Ausschnitt bleibt auf dem Board
    setView({ half: h, cx: Math.max(-lim, Math.min(lim, cx)), cy: Math.max(-lim, Math.min(lim, cy)) });
  };
  const zoomBy = (factor: number) => setZoom(view.half / factor, view.cx, view.cy);

  /** Bildschirmpunkt → mm im aktuellen Ausschnitt. */
  const toMm = (clientX: number, clientY: number, v = viewRef.current) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = v.cx - v.half + ((clientX - r.left) / r.width) * 2 * v.half;
    const y = v.cy - v.half + ((clientY - r.top) / r.height) * 2 * v.half;
    return { x: Math.max(-MAX_HALF, Math.min(MAX_HALF, x)), y: Math.max(-MAX_HALF, Math.min(MAX_HALF, y)) };
  };

  // Aktive Finger; bei zwei Fingern wird gezoomt statt markiert.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; half: number; mid: { x: number; y: number }; before: typeof pending } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const downAt = useRef<{ x: number; y: number; before: typeof pending } | null>(null);

  const twoFinger = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    try {
      svgRef.current!.setPointerCapture(e.pointerId);
    } catch {
      // ohne Capture geht es auch
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Zwei Finger: Zoom beginnt; der eben gesetzte Punkt wird zurückgenommen
      const { dist, mid } = twoFinger();
      pinch.current = { dist, half: viewRef.current.half, mid: toMm(mid.x, mid.y), before: downAt.current?.before ?? pending };
      setPending(pinch.current.before);
      setTouch(null);
      return;
    }
    if (pointers.current.size > 2 || !state.next) return;
    downAt.current = { x: e.clientX, y: e.clientY, before: pending };
    setPending(toMm(e.clientX, e.clientY));
    setTouch({ cx: e.clientX, cy: e.clientY });
  };

  const onMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const { dist, mid } = twoFinger();
      const half = Math.max(MIN_HALF, Math.min(MAX_HALF, (pinch.current.half * pinch.current.dist) / Math.max(dist, 1)));
      // Der mm-Punkt unter der Fingermitte bleibt unter der Fingermitte
      const r = svgRef.current!.getBoundingClientRect();
      const fx = (mid.x - r.left) / r.width;
      const fy = (mid.y - r.top) / r.height;
      setZoom(half, pinch.current.mid.x - (fx * 2 - 1) * half, pinch.current.mid.y - (fy * 2 - 1) * half);
      return;
    }
    if (!touch || pinch.current) return;
    setPending(toMm(e.clientX, e.clientY));
    setTouch({ cx: e.clientX, cy: e.clientY });
  };

  const onUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    setTouch(null);
    if (pinch.current) {
      if (pointers.current.size === 0) pinch.current = null;
      return;
    }
    // Doppeltipp: an dieser Stelle vergrößern
    const d = downAt.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12) {
      const prev = lastTap.current;
      const now = performance.now();
      if (prev && now - prev.t < 350 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 40) {
        const at = toMm(e.clientX, e.clientY);
        setZoom(viewRef.current.half / 2, at.x, at.y);
        lastTap.current = null;
      } else {
        lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      }
    }
    downAt.current = null;
  };

  const confirmThrow = () => {
    if (!state.next || !pending) return;
    const x = Math.round(pending.x * 10) / 10;
    const y = Math.round(pending.y * 10) / 10;
    // Sofort zurücksetzen, damit ein gleich folgender Tipp des nächsten Spielers nicht verloren geht.
    setPending(null);
    lastTap.current = null; // ein Doppeltipp zählt nur innerhalb eines Wurfs
    act([
      {
        type: 'bulloff.throw',
        payload: { gameId, slot: state.next.slot, attempt: state.next.attempt, xMm: x, yMm: y, distanceMm: distanceMm(x, y) },
      },
    ]);
  };

  // Computer (SPEC 9): wirft beim Ausbullen selbst, mit der Streuung seiner Stufe um den Mittelpunkt.
  const bot = game.created.participants.find((x) => x.slot === state.next?.slot && x.kind === 'bot');
  const nextKey = state.next ? `${state.next.slot}|${state.next.attempt}` : '';
  useEffect(() => {
    // Erst werfen, wenn der vorige Wurf gespeichert ist (sonst würde er als Doppel-Tipp verworfen)
    if (!bot || !state.next || busy) return;
    const next = state.next;
    const timer = setTimeout(() => {
      const sigma = (bot.botHuman === false ? BOT_SIGMA : BOT_SIGMA_HUMAN)[bot.botLevel ?? 5];
      const p = aimPoint({ n: BULL, m: 2 });
      const x = Math.round((p.x + gaussian(Math.random) * sigma) * 10) / 10;
      const y = Math.round((p.y + gaussian(Math.random) * sigma) * 10) / 10;
      act([
        {
          type: 'bulloff.throw',
          payload: { gameId, slot: next.slot, attempt: next.attempt, xMm: x, yMm: y, distanceMm: distanceMm(x, y) },
        },
      ]);
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
    // Nur einmal je Wurf des Computers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKey, bot?.slot, busy]);

  const undoLast = () => {
    const last = state.throws.reduce<(typeof state.throws)[number] | null>(
      (best, t) => (!best || gameEvents.findIndex((e) => e.id === t.id) > gameEvents.findIndex((e) => e.id === best.id) ? t : best),
      null,
    );
    setPending(null);
    lastTap.current = null;
    if (last) act([{ type: 'event.voided', payload: { gameId, targetId: last.id, reason: 'undo' } }]);
  };

  const rethrowAll = () =>
    act(state.throws.map((t) => ({ type: 'event.voided', payload: { gameId, targetId: t.id, reason: 'undo' } })));

  // Die Lupe vergrößert immer stärker als der Ausschnitt.
  const loupe = Math.min(LOUPE, view.half / 3);

  // Letzter Wurf je Spieler (höchster Durchgang)
  const latest = new Map<number, (typeof state.throws)[number]>();
  for (const t of state.throws) if (!latest.has(t.slot) || latest.get(t.slot)!.attempt < t.attempt) latest.set(t.slot, t);

  return (
    <>
      <div class="bull-tiles">
        {slots.map((slot) => {
          const t = latest.get(slot);
          const active = state.next?.slot === slot;
          const first = state.order?.[0] === slot;
          return (
            <div key={slot} class={active ? 'bull-tile active' : 'bull-tile'} style={{ borderColor: colorOf(slot) }}>
              <div class="score-name">
                <span class="dot" style={{ background: colorOf(slot) }} /> {nameOf(slot)} {first ? '👑' : ''}
              </div>
              <div class="bull-result">{active ? 'wirft …' : t ? distanceLabel(t.distanceMm) : '—'}</div>
            </div>
          );
        })}
      </div>

      {state.next && (
        <p class="bull-hint">
          {state.rethrow.length > 0 && (
            <>
              Gleich weit: {state.rethrow[0].map(nameOf).join(' und ')} werfen noch einmal.
              <br />
            </>
          )}
          <strong>{nameOf(state.next.slot)}</strong>: Wirf auf das Bull und tippe die Stelle an, an der dein Dart steckt.
        </p>
      )}

      <div class="bull-view-wrap">
        <svg
          ref={svgRef}
          class="bull-view"
          viewBox={`${view.cx - view.half} ${view.cy - view.half} ${2 * view.half} ${2 * view.half}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Vergrößertes Bull zum Markieren"
        >
          <BoardArt />
          {[...latest.values()].map((t) => (
            <Marker key={t.id} x={t.xMm} y={t.yMm} color={colorOf(t.slot)} scale={view.half / VIEW} />
          ))}
          {pending && state.next && (
            <Marker x={pending.x} y={pending.y} color={colorOf(state.next.slot)} ring scale={view.half / VIEW} />
          )}
        </svg>
        <div class="zoom-buttons">
          <button class="btn btn-small" onClick={() => zoomBy(1 / 1.6)} disabled={view.half >= MAX_HALF} aria-label="Verkleinern">
            −
          </button>
          <button class="btn btn-small" onClick={() => zoomBy(1.6)} disabled={view.half <= MIN_HALF} aria-label="Vergrößern">
            +
          </button>
          <button
            class="btn btn-small"
            onClick={() => setZoom(VIEW, 0, 0)}
            disabled={view.half === VIEW && view.cx === 0 && view.cy === 0}
          >
            Bull
          </button>
        </div>
        {touch && pending && state.next && (
          <div class="loupe" style={{ left: `${Math.max(8, touch.cx - 60)}px`, top: `${Math.max(8, touch.cy - 150)}px` }}>
            <svg viewBox={`${pending.x - loupe} ${pending.y - loupe} ${2 * loupe} ${2 * loupe}`}>
              <BoardArt />
              {[...latest.values()].map((t) => (
                <Marker key={t.id} x={t.xMm} y={t.yMm} color={colorOf(t.slot)} small />
              ))}
              <Marker x={pending.x} y={pending.y} color={colorOf(state.next.slot)} ring small />
            </svg>
          </div>
        )}
      </div>

      {state.next ? (
        <div class="row">
          <button class="btn" disabled={busy || state.throws.length === 0} onClick={undoLast}>
            ↶
          </button>
          <button class="btn btn-primary grow" disabled={busy || !pending} onClick={confirmThrow}>
            {pending ? `Wurf bestätigen · ${distanceLabel(distanceMm(pending.x, pending.y))}` : 'Stelle antippen'}
          </button>
        </div>
      ) : (
        state.order && <Result order={state.order} nameOf={nameOf} onRethrow={rethrowAll} gameId={gameId} busy={busy} />
      )}
    </>
  );
}

/** Reihenfolge anzeigen, „Erneut werfen“ oder „Spiel anfangen (5)“ mit Countdown (SPEC 6.4, Punkt 7). */
function Result({
  order,
  nameOf,
  onRethrow,
  gameId,
  busy,
}: {
  order: number[];
  nameOf: (s: number) => string;
  onRethrow: () => void;
  gameId: string;
  busy: boolean;
}) {
  const { append } = useAppData();
  const [count, setCount] = useState<number | null>(5);
  const started = useRef(false);
  const start = () => {
    if (started.current) return;
    started.current = true;
    append([{ type: 'game.orderDecided', payload: { gameId, order, method: 'bull' } }]);
  };
  useEffect(() => {
    if (count === null) return;
    if (count <= 0) {
      start();
      return;
    }
    const t = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <section class="card">
      <ol class="ranking">
        {order.map((s) => (
          <li key={s}>{nameOf(s)}</li>
        ))}
      </ol>
      <div class="row">
        <button
          class="btn"
          disabled={busy}
          onClick={() => {
            setCount(null);
            onRethrow();
          }}
        >
          Erneut werfen
        </button>
        <button class="btn btn-primary grow" disabled={busy} onClick={start}>
          Spiel anfangen{count !== null ? ` (${count})` : ''}
        </button>
      </div>
      {count !== null && (
        <button class="btn btn-small" onClick={() => setCount(null)}>
          Countdown anhalten
        </button>
      )}
    </section>
  );
}

/** Neutrale Grafik um das Bull: Segmente, Single-Bull, Bullseye. Keine Beschriftung, keine fremden Marken. */
/** Ringgrenzen in mm (SPEC Kapitel 1): Triple 99–107, Double 162–170, außen der Zahlenring. */
const TRIPLE_IN = 99;
const TRIPLE_OUT = 107;
const DOUBLE_IN = 162;
const DOUBLE_OUT = 170;
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

function polar(r: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  return `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
}

function ring(r0: number, r1: number, a0: number, a1: number): string {
  return `M ${polar(r0, a0)} L ${polar(r1, a0)} A ${r1} ${r1} 0 0 1 ${polar(r1, a1)} L ${polar(r0, a1)} A ${r0} ${r0} 0 0 0 ${polar(r0, a0)} Z`;
}

/**
 * Ganzes Board in echten Maßen, damit man bis zum Rand herauszoomen kann.
 * Eigene, neutrale Grafik: nur die Zahlen 1–20, keine fremde Beschriftung.
 */
function BoardArt() {
  return (
    <g>
      <rect x={-MAX_HALF * 2} y={-MAX_HALF * 2} width={MAX_HALF * 4} height={MAX_HALF * 4} style={{ fill: 'var(--bg)' }} />
      <circle r={MAX_HALF} class="b-miss" />
      {ORDER.map((n, i) => {
        const a0 = i * 18 - 9;
        const a1 = i * 18 + 9;
        const dark = i % 2 === 0;
        const single = dark ? 'b-single-dark' : 'b-single-light';
        const color = dark ? 'b-ring-red' : 'b-ring-green';
        const [lx, ly] = polar((DOUBLE_OUT + MAX_HALF) / 2, i * 18).split(' ');
        return (
          <g key={n}>
            <path d={ring(SINGLE_BULL_R, TRIPLE_IN, a0, a1)} class={single} />
            <path d={ring(TRIPLE_IN, TRIPLE_OUT, a0, a1)} class={color} />
            <path d={ring(TRIPLE_OUT, DOUBLE_IN, a0, a1)} class={single} />
            <path d={ring(DOUBLE_IN, DOUBLE_OUT, a0, a1)} class={color} />
            <text x={lx} y={ly} class="b-label" style={{ fontSize: "13px" }} text-anchor="middle" dominant-baseline="central">
              {n}
            </text>
          </g>
        );
      })}
      <circle r={SINGLE_BULL_R} class="b-ring-green" />
      <circle r={BULLSEYE_R} class="b-ring-red" />
    </g>
  );
}

function Marker({
  x,
  y,
  color,
  ring,
  small,
  scale = 1,
}: {
  x: number;
  y: number;
  color: string;
  ring?: boolean;
  small?: boolean;
  /** Beim Vergrößern bleiben die Punkte auf dem Bildschirm gleich groß. */
  scale?: number;
}) {
  const r = (small ? 0.9 : 2.4) * scale;
  return (
    <g pointer-events="none">
      <circle cx={x} cy={y} r={r} fill={color} stroke="#fff" stroke-width={small ? 0.25 : 0.6} />
      {ring && <circle cx={x} cy={y} r={r * 2.2} fill="none" stroke="#fff" stroke-width={small ? 0.15 : 0.4} />}
    </g>
  );
}
