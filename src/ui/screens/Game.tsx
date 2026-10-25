// Spielansicht X01 (SPEC 4.4, 5, 7.1): Stand, Aufnahme als Pills, Rechenzeile, Checkout-Vorschlag, Board.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { alternativeCheckout, formatCheckout, suggestCheckout } from '../../engine/checkout';
import { gameEventsOf, type NewAppEvent } from '../../engine/events';
import { listGames, x01SetupOf } from '../../engine/games';
import { listProfiles } from '../../engine/profiles';
import { formatAverage, legNumbers, matchNumbers, turnScore } from '../../engine/stats';
import { fieldLabel, MISS, points, type Field } from '../../engine/types';
import { computeX01, confirmTurn, planEdit, throwDart, undo, type Turn, type X01State } from '../../engine/x01';
import { uuidv7 } from '../../data/ids';
import { Board } from '../board/Board';
import { TopBar } from '../components';
import { useAppData } from '../data';
import { participantColor, participantName } from '../names';
import { href, navigate } from '../router';
import { EditRound } from './EditRound';
import { MatchEnd } from './MatchEnd';

export function Game({ gameId }: { gameId: string }) {
  const { events, append } = useAppData();
  const profiles = useMemo(() => listProfiles(events), [events]);
  const game = useMemo(() => listGames(events).find((g) => g.created.gameId === gameId), [events, gameId]);
  const gameEvents = useMemo(() => gameEventsOf(events, gameId), [events, gameId]);
  const state = useMemo(() => (game ? computeX01(x01SetupOf(game), gameEvents) : null), [game, gameEvents]);
  const [busy, setBusy] = useState(false);
  // Zusätzlich als Ref, weil zwei schnelle Tipps im selben Moment den neuen Zustand noch nicht sehen.
  const busyRef = useRef(false);
  const [editing, setEditing] = useState(false);

  useWakeLock();

  if (!game || !state) {
    return (
      <div class="page">
        <TopBar title="Spiel" back={href({ name: 'home' })} />
        <p>Dieses Spiel gibt es nicht.</p>
      </div>
    );
  }

  const nameOf = (slot: number) => participantName(game.created.participants.find((p) => p.slot === slot)!, profiles);
  const colorOf = (slot: number) => participantColor(game.created.participants.find((p) => p.slot === slot)!, profiles);

  /** Ereignisse anhängen; während des Schreibens sind weitere Eingaben gesperrt (kein Doppel-Tipp). */
  const act = async (evs: readonly NewAppEvent[]) => {
    if (busyRef.current || !evs.length) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await append(evs);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onDart = (f: Field) => {
    const ev = throwDart(state, f);
    if (ev) act([ev]);
  };

  const removeDart = (turn: Turn, index: number) => {
    const fields = turn.darts.filter((_, i) => i !== index).map((d) => d.field);
    const plan = planEdit(state, gameEvents, turn, fields);
    if (plan.error) return alert(plan.error);
    const lost = plan.discarded.filter((id) => gameEvents.some((e) => e.id === id && e.type === 'dart.thrown')).length;
    if (lost && !confirm(`Danach geworfene ${lost} Darts werden verworfen. Fortfahren?`)) return;
    act(plan.events);
  };

  const abandon = async () => {
    if (!confirm('Spiel abbrechen? Es bleibt gespeichert, zählt aber nicht als beendet.')) return;
    await append([{ type: 'game.ended', payload: { gameId, reason: 'abandoned' } }]);
    navigate({ name: 'home' }, true);
  };

  const finish = async (rematch: boolean) => {
    const evs: NewAppEvent[] = [{ type: 'game.ended', payload: { gameId, reason: 'finished' } }];
    const newId = uuidv7();
    if (rematch) {
      evs.push(
        { type: 'game.created', payload: { ...game.created, gameId: newId, seed: Date.now() } },
        { type: 'game.orderDecided', payload: { gameId: newId, order: game.order, method: 'asEntered' } },
      );
    }
    await append(evs);
    navigate(rematch ? { name: 'game', gameId: newId } : { name: 'home' }, true);
  };

  const s = game.created.settings;
  const turn = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const leg = state.legs[state.legs.length - 1];
  const legWon = turn?.checkout && state.awaitingConfirm && state.matchWinner === null;

  return (
    <div class="screen screen-game">
      <section class="panel">
        <TopBar
          title={`${s.startScore} · ${s.outMode === 'double' ? 'Double-Out' : s.outMode === 'master' ? 'Master-Out' : 'Single-Out'}`}
          back={href({ name: 'home' })}
          right={
            <button class="btn btn-small" onClick={abandon}>
              Abbrechen
            </button>
          }
        />

        <Scoreboard state={state} order={game.order} activeSlot={activeSlot} nameOf={nameOf} colorOf={colorOf} />

        <section class="turnbox" style={{ borderColor: colorOf(activeSlot) }}>
          <div class="turn-head">
            <strong>{nameOf(activeSlot)}</strong>
            <span class="muted">
              Leg {leg.leg}
              {s.sets ? ` · Set ${leg.set}` : ''} · Aufnahme {turn?.turnIndex ?? state.next?.turnIndex ?? 1}
            </span>
          </div>
          <div class="pills">
            {turn?.darts.map((d, i) => (
              <button
                key={d.id}
                class={`pill m${d.field.m}`}
                disabled={busy}
                onClick={() => removeDart(turn, i)}
                aria-label={`${fieldLabel(d.field)} entfernen`}
              >
                {fieldLabel(d.field)} · {points(d.field)} <span class="pill-x">×</span>
              </button>
            ))}
            {!turn?.darts.length && <span class="muted">Noch kein Dart</span>}
          </div>
          <TurnLine turn={turn} state={state} />
          <CheckoutHint state={state} advice={game.created.advice} />
          {legWon && (
            <p class="banner">
              Leg an {nameOf(turn!.slot)} · {legNumbers(leg, turn!.slot).darts} Darts · Average{' '}
              {formatAverage(legNumbers(leg, turn!.slot).average)}
            </p>
          )}
        </section>

        <div class="actions">
          <button class="btn" disabled={busy || state.actions.length === 0} onClick={() => act(undo(state))} aria-label="Rückgängig">
            ↶
          </button>
          <button class="btn" disabled={busy || leg.turns.length === 0} onClick={() => setEditing(true)}>
            ✎ Runden
          </button>
          <button class="btn" disabled={busy || !state.next} onClick={() => onDart(MISS)}>
            Daneben
          </button>
          <button
            class={state.awaitingConfirm ? 'btn btn-primary grow' : 'btn grow'}
            disabled={busy || !turn || turn.confirmed || state.matchWinner !== null}
            onClick={() => act(confirmTurn(state))}
          >
            Weiter →
          </button>
        </div>
      </section>

      <section class="board-wrap">
        <Board onDart={onDart} disabled={busy || !state.next} />
      </section>

      {editing && (
        <EditRound
          state={state}
          gameEvents={gameEvents}
          nameOf={nameOf}
          onClose={() => setEditing(false)}
          onApply={async (evs) => {
            await act(evs);
            setEditing(false);
          }}
        />
      )}

      {state.matchWinner !== null && (
        <MatchEnd
          state={state}
          order={game.order}
          nameOf={nameOf}
          onUndo={() => act(undo(state))}
          onRematch={() => finish(true)}
          onDone={() => finish(false)}
        />
      )}
    </div>
  );
}

function Scoreboard({
  state,
  order,
  activeSlot,
  nameOf,
  colorOf,
}: {
  state: X01State;
  order: number[];
  activeSlot: number;
  nameOf: (s: number) => string;
  colorOf: (s: number) => string;
}) {
  const sets = state.setup.settings.sets;
  return (
    <div class="scoreboard">
      {order.map((slot) => {
        const match = matchNumbers(state.legs, slot);
        return (
          <div
            key={slot}
            class={slot === activeSlot ? 'score-card active' : 'score-card'}
            style={{ borderColor: slot === activeSlot ? colorOf(slot) : undefined }}
          >
            <div class="score-name">
              <span class="dot" style={{ background: colorOf(slot) }} /> {nameOf(slot)}
            </div>
            <div class="score-rest">{state.remaining[slot]}</div>
            <div class="score-meta">
              {sets ? `Sets ${state.setsWon[slot]} · ` : ''}Legs {sets ? state.legsWonInSet[slot] : state.legsWon[slot]} · Ø{' '}
              {formatAverage(match.average)}
            </div>
            {!state.isIn[slot] && <div class="score-meta">noch nicht drin</div>}
          </div>
        );
      })}
    </div>
  );
}

function TurnLine({ turn, state }: { turn: Turn | null; state: X01State }) {
  if (!turn || turn.darts.length === 0) {
    const slot = state.next?.slot;
    return <div class="calc">{slot !== undefined ? `Rest ${state.remaining[slot]}` : ''}</div>;
  }
  if (turn.bust) return <div class="calc calc-bust">BUST · bleibt {turn.startRemaining}</div>;
  return (
    <div class="calc">
      {turn.startRemaining} − {turnScore(turn)} = <strong>{turn.endRemaining}</strong>
      {turn.checkout && ' · Checkout!'}
    </div>
  );
}

function CheckoutHint({ state, advice }: { state: X01State; advice: Parameters<typeof suggestCheckout>[3] }) {
  const pos = state.next;
  if (!pos || advice === 'off' || !state.isIn[pos.slot]) return null;
  const rest = state.remaining[pos.slot];
  const dartsLeft = 4 - pos.dartIndex;
  const out = state.setup.settings.outMode;
  const main = suggestCheckout(rest, dartsLeft, out, advice);
  if (!main) return null;
  const alt = alternativeCheckout(rest, dartsLeft, out, advice);
  return (
    <div class="checkout">
      <span class="checkout-main">{formatCheckout(main)}</span>
      {alt && <span class="checkout-alt">oder {formatCheckout(alt)}</span>}
    </div>
  );
}

/** Bildschirm bleibt an, solange ein Spiel offen ist (SPEC 5.3), wo der Browser das kann. */
function useWakeLock() {
  useEffect(() => {
    type Lock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } };
    if (!nav.wakeLock) return;
    let lock: Lock | null = null;
    const acquire = () => {
      if (document.visibilityState === 'visible') {
        nav.wakeLock!.request('screen').then((l) => (lock = l)).catch(() => undefined);
      }
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => undefined);
    };
  }, []);
}
