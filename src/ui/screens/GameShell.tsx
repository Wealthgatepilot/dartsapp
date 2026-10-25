// Rahmen jeder Spielansicht mit Board-Eingabe (SPEC 4.4, 5): Kopfzeile, Aufnahme als Pills,
// Knöpfe, Board, Runde bearbeiten und Spielende. Der Modus liefert Stand, Regeln und Texte.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CoreState, DartView, EditPlan, TurnBase } from '../../engine/core';
import type { GameEvent, NewAppEvent, NewEvent } from '../../engine/events';
import type { GameInfo } from '../../engine/games';
import { gameTitle } from '../../engine/games';
import { MISS, type Field } from '../../engine/types';
import { uuidv7 } from '../../data/ids';
import { Board } from '../board/Board';
import { TopBar } from '../components';
import { useAppData } from '../data';
import { href, navigate } from '../router';
import { EditRound } from './EditRound';
import { MatchEnd } from './MatchEnd';

// Die Spielansicht ist für alle Modi gleich; die Leg- und Aufnahmedaten des Modus braucht sie nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyState = CoreState<any, any>;

export interface ShellProps {
  game: GameInfo;
  gameEvents: GameEvent[];
  state: AnyState;
  nameOf: (slot: number) => string;
  colorOf: (slot: number) => string;
  /** Stand aller Spieler (Karten, Tafel …). */
  scoreboard: ComponentChildren;
  /** Unter den Pills: Rechenzeile, Checkout-Vorschlag, Hinweise. */
  turnDetails: ComponentChildren;
  pillText: (d: DartView) => string;
  /** Board-Eingabe. Fehlt sie, gibt es stattdessen die Treffer/Falsch-Flächen (hitMiss). */
  throwDart?: (f: Field) => NewEvent | null;
  confirm: () => NewEvent[];
  undo: () => NewEvent[];
  /** Runde bearbeiten und Pills entfernen; fehlt es, gibt es beides nicht (Training: Rückgängig genügt). */
  planEdit?: (target: TurnBase, fields: Field[]) => EditPlan;
  /** Kurzfassung einer Aufnahme in „Runde bearbeiten“, z. B. „60“ oder „Bust“. */
  summary?: (t: TurnBase) => string;
  /** Nur diese Zahlen sind auf dem Board farbig. */
  isTarget?: (n: number) => boolean;
  /** Tabelle am Spielende. */
  endTable: ComponentChildren;
  /** Platz über dem Board im Hochformat in Pixeln (größer = kleineres Board, z. B. für die Cricket-Tafel). */
  reserve?: number;
  /** Zusätzliches Fenster über dem Spiel, z. B. eine Frage nach einem Shanghai. Bekommt `act` zum Speichern. */
  overlay?: (act: (evs: readonly NewAppEvent[]) => Promise<void>) => ComponentChildren;
  /** „Weiter“ sperren, z. B. solange eine Frage offen ist. */
  blockConfirm?: boolean;
  /** Treffer/Falsch-Eingabe statt Board (SPEC 4.5). */
  hitMiss?: { targetLabel: string; onHit: () => NewEvent | null; onMiss: () => NewEvent | null };
}

export function GameShell(p: ShellProps) {
  const { append } = useAppData();
  const { game, state, gameEvents } = p;
  const gameId = game.created.gameId;
  const [busy, setBusy] = useState(false);
  // Zusätzlich als Ref, weil zwei schnelle Tipps im selben Moment den neuen Zustand noch nicht sehen.
  const busyRef = useRef(false);
  const [editing, setEditing] = useState(false);

  useWakeLock();
  useNoPinchZoom();

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
    const ev = p.throwDart?.(f);
    if (ev) act([ev]);
  };

  const removeDart = (turn: TurnBase, index: number) => {
    if (!p.planEdit) return;
    const plan = p.planEdit(
      turn,
      turn.darts.filter((_, i) => i !== index).map((d) => d.field),
    );
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

  const turn: TurnBase | null = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const leg = state.legs[state.legs.length - 1];

  return (
    <div class={p.hitMiss ? "screen screen-game screen-hitmiss" : "screen screen-game"} style={p.reserve ? { '--reserve': `${p.reserve}px` } : undefined}>
      <section class="panel">
        <TopBar
          title={gameTitle(game.created)}
          back={href({ name: 'home' })}
          right={
            <button class="btn btn-small" onClick={abandon}>
              Abbrechen
            </button>
          }
        />

        {/* Nur der Spielstand scrollt; Aufnahme und Knöpfe bleiben immer sichtbar. */}
        <div class="panel-scroll">{p.scoreboard}</div>

        <section class="turnbox" style={{ borderColor: p.colorOf(activeSlot) }}>
          <div class="turn-head">
            <strong>{p.nameOf(activeSlot)}</strong>
            <span class="muted">
              {state.format ? `Leg ${leg.leg}${state.format.sets ? ` · Set ${leg.set}` : ''} · ` : ''}
              Aufnahme {turn?.turnIndex ?? state.next?.turnIndex ?? 1}
            </span>
          </div>
          <div class="pills">
            {turn?.darts.map((d, i) => (
              <button
                key={d.id}
                class={`pill m${d.field.m}`}
                disabled={busy || !p.planEdit}
                onClick={() => removeDart(turn, i)}
                aria-label={`${p.pillText(d)} entfernen`}
              >
                {p.pillText(d)} {p.planEdit && <span class="pill-x">×</span>}
              </button>
            ))}
            {!turn?.darts.length && <span class="muted">Noch kein Dart</span>}
          </div>
          {p.turnDetails}
        </section>

        <div class="actions">
          {!p.hitMiss && (
            <button class="btn" disabled={busy || state.actions.length === 0} onClick={() => act(p.undo())} aria-label="Rückgängig">
              ↶
            </button>
          )}
          {p.planEdit && (
            <button class="btn" disabled={busy || leg.turns.length === 0} onClick={() => setEditing(true)}>
              ✎ Runden
            </button>
          )}
          {p.throwDart && (
            <button class="btn" disabled={busy || !state.next} onClick={() => onDart(MISS)}>
              Daneben
            </button>
          )}
          <button
            class={state.awaitingConfirm ? 'btn btn-primary grow' : 'btn grow'}
            disabled={busy || !turn || turn.confirmed || state.finished || p.blockConfirm}
            onClick={() => act(p.confirm())}
          >
            Weiter →
          </button>
        </div>
      </section>

      {p.hitMiss ? (
        <section class="hitmiss">
          <button class="hm-undo" disabled={busy || state.actions.length === 0} onClick={() => act(p.undo())} aria-label="Rückgängig">
            ↶
          </button>
          <button class="hm-miss" disabled={busy || !state.next} onClick={() => act([p.hitMiss!.onMiss()].filter((e): e is NewEvent => !!e))}>
            Falsch
          </button>
          <button class="hm-hit" disabled={busy || !state.next} onClick={() => act([p.hitMiss!.onHit()].filter((e): e is NewEvent => !!e))}>
            {p.hitMiss.targetLabel}
          </button>
        </section>
      ) : (
        <section class="board-wrap">
          <Board onDart={onDart} disabled={busy || !state.next} isTarget={p.isTarget} />
        </section>
      )}

      {editing && p.planEdit && p.summary && (
        <EditRound
          legNo={leg.leg}
          turns={leg.turns}
          gameEvents={gameEvents}
          nameOf={p.nameOf}
          summary={p.summary}
          planEdit={p.planEdit}
          isTarget={p.isTarget}
          onClose={() => setEditing(false)}
          onApply={async (evs) => {
            await act(evs);
            setEditing(false);
          }}
        />
      )}

      {p.overlay?.(act)}

      {state.finished && (
        <MatchEnd
          winners={state.matchWinners ?? []}
          nameOf={p.nameOf}
          onUndo={() => act(p.undo())}
          onRematch={() => finish(true)}
          onDone={() => finish(false)}
        >
          {p.endTable}
        </MatchEnd>
      )}
    </div>
  );
}

/**
 * Kein Zoom mit zwei Fingern in der Spielansicht (SPEC 4.3, Punkt 7). Safari auf iPhone und iPad
 * hält sich dabei nicht immer an die Angaben im Viewport, deshalb wird die Geste hier direkt abgefangen.
 */
function useNoPinchZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const twoFingers = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener('gesturestart', stop, { passive: false });
    document.addEventListener('gesturechange', stop, { passive: false });
    document.addEventListener('touchmove', twoFingers, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', stop);
      document.removeEventListener('gesturechange', stop);
      document.removeEventListener('touchmove', twoFingers);
    };
  }, []);
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
