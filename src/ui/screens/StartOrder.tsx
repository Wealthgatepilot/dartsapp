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
import type { GameEvent, NewAppEvent } from '../../engine/events';
import type { GameInfo } from '../../engine/games';
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

  const toMm = (e: PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 * VIEW - VIEW;
    const y = ((e.clientY - r.top) / r.height) * 2 * VIEW - VIEW;
    return { x: Math.max(-VIEW, Math.min(VIEW, x)), y: Math.max(-VIEW, Math.min(VIEW, y)) };
  };
  const onDown = (e: PointerEvent) => {
    if (!state.next) return;
    e.preventDefault();
    try {
      svgRef.current!.setPointerCapture(e.pointerId);
    } catch {
      // ohne Capture geht es auch
    }
    setPending(toMm(e));
    setTouch({ cx: e.clientX, cy: e.clientY });
  };
  const onMove = (e: PointerEvent) => {
    if (!touch) return;
    setPending(toMm(e));
    setTouch({ cx: e.clientX, cy: e.clientY });
  };
  const onUp = () => setTouch(null);

  const confirmThrow = () => {
    if (!state.next || !pending) return;
    const x = Math.round(pending.x * 10) / 10;
    const y = Math.round(pending.y * 10) / 10;
    // Sofort zurücksetzen, damit ein gleich folgender Tipp des nächsten Spielers nicht verloren geht.
    setPending(null);
    act([
      {
        type: 'bulloff.throw',
        payload: { gameId, slot: state.next.slot, attempt: state.next.attempt, xMm: x, yMm: y, distanceMm: distanceMm(x, y) },
      },
    ]);
  };

  const undoLast = () => {
    const last = state.throws.reduce<(typeof state.throws)[number] | null>(
      (best, t) => (!best || gameEvents.findIndex((e) => e.id === t.id) > gameEvents.findIndex((e) => e.id === best.id) ? t : best),
      null,
    );
    setPending(null);
    if (last) act([{ type: 'event.voided', payload: { gameId, targetId: last.id, reason: 'undo' } }]);
  };

  const rethrowAll = () =>
    act(state.throws.map((t) => ({ type: 'event.voided', payload: { gameId, targetId: t.id, reason: 'undo' } })));

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
          viewBox={`${-VIEW} ${-VIEW} ${2 * VIEW} ${2 * VIEW}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Vergrößertes Bull zum Markieren"
        >
          <BullArt />
          {[...latest.values()].map((t) => (
            <Marker key={t.id} x={t.xMm} y={t.yMm} color={colorOf(t.slot)} />
          ))}
          {pending && state.next && <Marker x={pending.x} y={pending.y} color={colorOf(state.next.slot)} ring />}
        </svg>
        {touch && pending && state.next && (
          <div class="loupe" style={{ left: `${Math.max(8, touch.cx - 60)}px`, top: `${Math.max(8, touch.cy - 150)}px` }}>
            <svg viewBox={`${pending.x - LOUPE} ${pending.y - LOUPE} ${2 * LOUPE} ${2 * LOUPE}`}>
              <BullArt />
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
function BullArt() {
  const wedges = Array.from({ length: 20 }, (_, i) => {
    const a0 = ((i * 18 - 9) * Math.PI) / 180;
    const a1 = ((i * 18 + 9) * Math.PI) / 180;
    const R = VIEW * 1.5;
    const p = (r: number, a: number) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
    return (
      <path
        key={i}
        d={`M ${p(SINGLE_BULL_R, a0)} L ${p(R, a0)} L ${p(R, a1)} L ${p(SINGLE_BULL_R, a1)} Z`}
        class={i % 2 === 0 ? 'b-single-dark' : 'b-single-light'}
      />
    );
  });
  return (
    <g>
      <rect x={-VIEW * 2} y={-VIEW * 2} width={VIEW * 4} height={VIEW * 4} class="b-single-dark" />
      {wedges}
      <circle r={SINGLE_BULL_R} class="b-ring-green" />
      <circle r={BULLSEYE_R} class="b-ring-red" />
    </g>
  );
}

function Marker({ x, y, color, ring, small }: { x: number; y: number; color: string; ring?: boolean; small?: boolean }) {
  const r = small ? 0.9 : 2.4;
  return (
    <g pointer-events="none">
      <circle cx={x} cy={y} r={r} fill={color} stroke="#fff" stroke-width={small ? 0.25 : 0.6} />
      {ring && <circle cx={x} cy={y} r={r * 2.2} fill="none" stroke="#fff" stroke-width={small ? 0.15 : 0.4} />}
    </g>
  );
}
