// Count-Up-Ansicht (SPEC 7.10): Spielerblöcke mit Punkten, Average und Aufnahmen 80+ … 180;
// bei Begrenzung „Zeit“ die Restzeit mit Pause, bei „zusammen“ eine Team-Zeile.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  computeCountUp,
  confirmCountUpTurn,
  countUpClock,
  isTimed,
  pauseCountUp,
  planCountUpEdit,
  throwCountUpDart,
  timeUpCountUp,
  undoCountUp,
  type CountUpClock,
  type CountUpState,
  type CountUpTurn,
} from '../../engine/countup';
import type { NewAppEvent } from '../../engine/events';
import { countUpSetupOf } from '../../engine/games';
import { countUpMetrics, type CountUpMetrics } from '../../engine/metrics';
import { formatAverage } from '../../engine/stats';
import { fieldLabel } from '../../engine/types';
import { type Block, PlayerBlocks } from '../blocks';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

/** Aufnahmen je Bereich wie bei X01 (80–99 … 180). */
const BUCKETS = [
  { key: 's80', label: '80+' },
  { key: 's100', label: '100+' },
  { key: 's120', label: '120+' },
  { key: 's140', label: '140+' },
  { key: 's160', label: '160+' },
  { key: 's180', label: '180' },
] as const;

/** Restzeit als „47:12“ bzw. „1:05:00“. */
function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Aktuelle Uhrzeit, jede halbe Sekunde neu (nur solange `on`). */
function useNow(on: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

export function CountUpGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeCountUp(countUpSetupOf(game), gameEvents), [game, gameEvents]);
  const s = state.setup.settings;
  const timed = isTimed(s);
  const team = s.scoring === 'team' && game.order.length > 1;
  const now = useNow(timed && !state.finished);
  const clock = timed ? countUpClock(state.setup, gameEvents, now) : null;
  const turn = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const round = turn?.turnIndex ?? state.next?.turnIndex ?? 1;
  const metrics = Object.fromEntries(game.order.map((slot) => [slot, countUpMetrics(state, slot)])) as Record<number, CountUpMetrics>;
  const paused = !!clock?.paused && !state.finished;

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      scoreboard={
        <>
          {clock ? (
            <div class={clock.remainingMs <= 60_000 && clock.started ? 'cu-timer cu-timer-last' : 'cu-timer'}>
              <strong>{formatClock(clock.remainingMs)}</strong>
              <span class="muted">
                {state.timeUp ? 'Zeit um – Runde wird zu Ende gespielt' : !clock.started ? 'startet mit dem ersten Dart' : paused ? 'Pause' : `Runde ${round}`}
              </span>
            </div>
          ) : (
            <div class="round-head">
              Runde <strong>{Math.min(round, s.rounds)}</strong> / {s.rounds}
            </div>
          )}
          {team && <TeamLine state={state} metrics={metrics} order={game.order} />}
          <PlayerBlocks blocks={blocksOf(game.order, metrics, state, nameOf, colorOf)} activeSlot={activeSlot} />
        </>
      }
      turnExtra={(act, busy) => (clock ? <TimerControl state={state} clock={clock} act={act} busy={busy} /> : null)}
      blockConfirm={paused}
      overlay={(act) =>
        paused ? (
          <div class="modal-backdrop">
            <div class="modal" role="dialog" aria-label="Pause">
              <header class="modal-head">
                <h2>⏸ Pause</h2>
              </header>
              <div class="modal-body">
                <p>Die Uhr ist angehalten. Noch {formatClock(clock!.remainingMs)}.</p>
                <button class="btn btn-primary" onClick={() => act(pauseCountUp(state, false))}>
                  Weiter
                </button>
              </div>
            </div>
          </div>
        ) : null
      }
      turnDetails={<div class="calc">{turn && turn.darts.length ? `+${turn.points}` : ''}</div>}
      pillText={(d) => `${fieldLabel(d.field)} · ${d.scored}`}
      throwDart={(f, input) => throwCountUpDart(state, f, input)}
      confirm={() => confirmCountUpTurn(state)}
      undo={() => undoCountUp(state)}
      planEdit={(t, fields) => planCountUpEdit(state, gameEvents, t, fields)}
      summary={(t) => `+${(t as CountUpTurn).points}`}
      endTitle={team ? `🎯 Team: ${game.order.reduce((n, slot) => n + state.points[slot], 0)} Punkte` : undefined}
      endTable={<Results state={state} order={game.order} metrics={metrics} nameOf={nameOf} team={team} />}
    />
  );
}

function blocksOf(
  order: number[],
  metrics: Record<number, CountUpMetrics>,
  state: CountUpState,
  nameOf: (s: number) => string,
  colorOf: (s: number) => string,
): Block[] {
  return order.map((slot) => {
    const m = metrics[slot];
    return {
      slot,
      name: nameOf(slot),
      color: colorOf(slot),
      big: String(state.points[slot]),
      pages: [
        [
          { label: 'Ø 3 Darts', value: formatAverage(m.avg) },
          { label: 'Letzte Aufnahme', value: m.lastTurn === null ? '—' : String(m.lastTurn) },
          { label: 'Darts', value: String(m.darts) },
        ],
        BUCKETS.slice(0, 3).map((b) => ({ label: b.label, value: String(m[b.key]) })),
        BUCKETS.slice(3).map((b) => ({ label: b.label, value: String(m[b.key]) })),
      ],
    };
  });
}

/** Zusammen: Summe und Average aller Spieler. */
function TeamLine({ state, metrics, order }: { state: CountUpState; metrics: Record<number, CountUpMetrics>; order: number[] }) {
  const points = order.reduce((n, slot) => n + state.points[slot], 0);
  const darts = order.reduce((n, slot) => n + metrics[slot].darts, 0);
  return (
    <div class="cu-team">
      Team <strong>{points}</strong> Punkte · Ø {formatAverage(darts ? (points / darts) * 3 : null)}
    </div>
  );
}

/** Pause-Knopf; ist die Zeit um, wird „Zeit abgelaufen“ einmal gespeichert (SPEC 7.10). */
function TimerControl({
  state,
  clock,
  act,
  busy,
}: {
  state: CountUpState;
  clock: CountUpClock;
  act: (evs: readonly NewAppEvent[]) => Promise<void>;
  busy: boolean;
}) {
  const sent = useRef(false);
  const expired = clock.started && clock.remainingMs <= 0 && !state.timeUp && !state.finished;
  useEffect(() => {
    if (!expired) {
      sent.current = false;
      return;
    }
    if (sent.current) return;
    sent.current = true;
    void act(timeUpCountUp(state));
  }, [expired]);
  if (!clock.started || state.timeUp || state.finished) return null;
  return (
    <button class="btn btn-small" disabled={busy || clock.paused} onClick={() => act(pauseCountUp(state, true))}>
      ⏸ Pause
    </button>
  );
}

/** Ergebnis: Punkte, Average und Aufnahmen je Bereich, bei „zusammen“ mit Team-Zeile. */
function Results({
  state,
  order,
  metrics,
  nameOf,
  team,
}: {
  state: CountUpState;
  order: number[];
  metrics: Record<number, CountUpMetrics>;
  nameOf: (s: number) => string;
  team: boolean;
}) {
  const sum = (key: (typeof BUCKETS)[number]['key']) => order.reduce((n, slot) => n + metrics[slot][key], 0);
  const points = order.reduce((n, slot) => n + state.points[slot], 0);
  const darts = order.reduce((n, slot) => n + metrics[slot].darts, 0);
  return (
    <div class="results-scroll">
      <table class="table table-compact">
        <thead>
          <tr>
            <th>Spieler</th>
            <th>Punkte</th>
            <th>Ø</th>
            {BUCKETS.map((b) => (
              <th key={b.key}>{b.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((slot) => (
            <tr key={slot}>
              <td>{nameOf(slot)}</td>
              <td>{state.points[slot]}</td>
              <td>{formatAverage(metrics[slot].avg)}</td>
              {BUCKETS.map((b) => (
                <td key={b.key}>{metrics[slot][b.key]}</td>
              ))}
            </tr>
          ))}
          {team && (
            <tr>
              <td>
                <strong>Team</strong>
              </td>
              <td>
                <strong>{points}</strong>
              </td>
              <td>
                <strong>{formatAverage(darts ? (points / darts) * 3 : null)}</strong>
              </td>
              {BUCKETS.map((b) => (
                <td key={b.key}>
                  <strong>{sum(b.key)}</strong>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
