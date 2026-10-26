// Rahmen jeder Spielansicht mit Board-Eingabe (SPEC 4.4, 5): Kopfzeile, Aufnahme als Pills,
// Knöpfe, Board, Runde bearbeiten und Spielende. Der Modus liefert Stand, Regeln und Texte.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CoreState, DartView, EditPlan, TurnBase } from '../../engine/core';
import { BOT_DELAY_MS, BOT_SIGMA, planAim, throwAtPoint, type Point } from '../../engine/bot';
import { botAim, sameField } from '../../engine/botaim';
import type { DartPayload, GameEvent, NewAppEvent, NewEvent } from '../../engine/events';
import type { AnyGameState, GameInfo } from '../../engine/games';
import { gameTitle } from '../../engine/games';
import { MISS, type Field } from '../../engine/types';
import { uuidv7 } from '../../data/ids';
import { Board } from '../board/Board';
import { TopBar } from '../components';
import { useAppData } from '../data';
import { href, navigate } from '../router';
import { BestCompare } from './BestCompare';
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
  /** Zusätzliche Knöpfe in der Kopfzeile vor 🏆, z. B. die Leg-Übersicht. */
  topActions?: ComponentChildren;
  /** Modus ohne Kennzahlen (Killer): kein Bestleistungs-Knopf. */
  noBest?: boolean;
  /** Einstellungen für die Revanche anpassen, z. B. neue Zufallszahlen bei Killer. */
  prepareRematch?: (created: GameInfo['created']) => GameInfo['created'];
  /** Stand aller Spieler (Karten, Tafel …). */
  scoreboard: ComponentChildren;
  /** Unter den Pills: Rechenzeile, Checkout-Vorschlag, Hinweise. */
  turnDetails: ComponentChildren;
  pillText: (d: DartView) => string;
  /** Board-Eingabe. Fehlt sie, gibt es stattdessen die Treffer/Falsch-Flächen (hitMiss). */
  throwDart?: (f: Field, input?: DartPayload['input']) => NewEvent | null;
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
  /**
   * Platz über dem Board im Hochformat in Pixeln, für eine große Tafel (Cricket). Gesetzt darf das Board
   * dort kleiner werden, damit die Tafel ganz sichtbar bleibt.
   */
  reserve?: number;
  /** Zusätzliches Fenster über dem Spiel, z. B. eine Frage nach einem Shanghai. Bekommt `act` zum Speichern. */
  overlay?: (act: (evs: readonly NewAppEvent[]) => Promise<void>) => ComponentChildren;
  /** „Weiter“ sperren, z. B. solange eine Frage offen ist. */
  blockConfirm?: boolean;
  /** Treffer/Falsch-Eingabe statt Board (SPEC 4.5). */
  hitMiss?: {
    targetLabel: string;
    onHit: (input?: DartPayload['input']) => NewEvent | null;
    onMiss: (input?: DartPayload['input']) => NewEvent | null;
  };
}

export function GameShell(p: ShellProps) {
  const { append } = useAppData();
  const { game, state, gameEvents } = p;
  const gameId = game.created.gameId;
  const [busy, setBusy] = useState(false);
  // Zusätzlich als Ref, weil zwei schnelle Tipps im selben Moment den neuen Zustand noch nicht sehen.
  const busyRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [showBest, setShowBest] = useState(false);

  useWakeLock();
  useNoPinchZoom();

  // Computergegner (SPEC 9): Ist er dran, wirft er Dart für Dart mit kurzer Pause. „Weiter“ tippt der Mensch.
  const bot = game.created.participants.find((x) => x.slot === state.next?.slot && x.kind === 'bot');
  const botTurn = !!bot && !state.finished;
  const botStuck = useRef<{ key: string; points: Point[] }>({ key: '', points: [] });
  const nextKey = state.next ? `${state.next.leg}|${state.next.slot}|${state.next.turnIndex}|${state.next.dartIndex}` : '';
  useEffect(() => {
    if (!bot || state.finished || editing || p.blockConfirm || !state.next || busy) return;
    const timer = setTimeout(() => {
      const wanted = botAim({ mode: game.created.mode, state } as AnyGameState);
      if (!wanted || !state.next) return;
      // Stellen der Darts, die in dieser Aufnahme schon stecken: Verdecken sie das Ziel, weicht er aus.
      const turnKey = `${state.next.leg}|${state.next.slot}|${state.next.turnIndex}`;
      if (botStuck.current.key !== turnKey) botStuck.current = { key: turnKey, points: [] };
      // Nach Rückgängig stecken nur noch die Darts vor dieser Position
      botStuck.current.points = botStuck.current.points.slice(0, state.next.dartIndex - 1);
      const plan = planAim(wanted, botStuck.current.points);
      const thrown = throwAtPoint(plan.point, BOT_SIGMA[bot.botLevel ?? 5], Math.random);
      botStuck.current.points.push(thrown.point);
      const aim = plan.target;
      const landed = thrown.field;
      const ev = p.hitMiss
        ? sameField(landed, aim)
          ? p.hitMiss.onHit('bot')
          : p.hitMiss.onMiss('bot')
        : (p.throwDart?.(landed, 'bot') ?? null);
      if (ev) act([ev]);
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
    // Nur bei einer neuen Position werfen; der Stand selbst ändert sich mit jedem Dart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKey, bot?.slot, state.finished, editing, p.blockConfirm, busy]);

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
      // Revanche mit Ausbullen oder Münzwurf lost die Reihenfolge neu aus; sonst gleiche Reihenfolge.
      const redecide = game.created.start === 'bull' || game.created.start === 'coin';
      const created = p.prepareRematch ? p.prepareRematch(game.created) : game.created;
      evs.push({ type: 'game.created', payload: { ...created, gameId: newId, seed: Date.now() } });
      if (!redecide) {
        evs.push({ type: 'game.orderDecided', payload: { gameId: newId, order: game.order, method: 'asEntered' } });
      }
    }
    await append(evs);
    navigate(rematch ? { name: 'game', gameId: newId } : { name: 'home' }, true);
  };

  const turn: TurnBase | null = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const leg = state.legs[state.legs.length - 1];

  return (
    <div
      class={`screen screen-game${p.hitMiss ? ' screen-hitmiss' : ''}${p.reserve ? ' screen-tafel' : ''}`}
      style={p.reserve ? { '--reserve': `${p.reserve}px` } : undefined}
    >
      <section class="panel">
        <TopBar
          title={gameTitle(game.created)}
          back={href({ name: 'home' })}
          right={
            <span class="row topbar-actions">
              {p.topActions}
              {!p.noBest && (
                <button class="btn btn-small" onClick={() => setShowBest(true)} aria-label="Bestleistung">
                  🏆
                </button>
              )}
              <button class="btn btn-small" onClick={abandon}>
                Abbrechen
              </button>
            </span>
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
            <button class="btn" disabled={busy || !state.next || botTurn} onClick={() => onDart(MISS)}>
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
          <button class="hm-miss" disabled={busy || !state.next || botTurn} onClick={() => act([p.hitMiss!.onMiss()].filter((e): e is NewEvent => !!e))}>
            Falsch
          </button>
          <button class="hm-hit" disabled={busy || !state.next || botTurn} onClick={() => act([p.hitMiss!.onHit()].filter((e): e is NewEvent => !!e))}>
            {p.hitMiss.targetLabel}
          </button>
        </section>
      ) : (
        <section class="board-wrap">
          <Board onDart={onDart} disabled={busy || !state.next || botTurn} isTarget={p.isTarget} />
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

      {showBest && (
        <BestCompare
          gameId={gameId}
          leg={leg.leg}
          participants={game.created.participants}
          activeSlot={activeSlot}
          nameOf={p.nameOf}
          onClose={() => setShowBest(false)}
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
