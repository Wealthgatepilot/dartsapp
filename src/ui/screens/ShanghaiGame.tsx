// Shanghai-Ansicht (SPEC 7.3): Runde und Ziel, Punkte, Marks pro Runde; nur das Ziel ist farbig.

import { useMemo } from 'preact/hooks';
import { shanghaiSetupOf } from '../../engine/games';
import {
  computeShanghai,
  confirmShanghaiTurn,
  decideShanghai,
  planShanghaiEdit,
  throwShanghaiDart,
  undoShanghai,
  type ShanghaiState,
  type ShanghaiTurn,
} from '../../engine/shanghai';
import { BULL, fieldLabel } from '../../engine/types';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

/** Marks pro 3 Darts (höchstens 9, SPEC 11.4). */
function mpr(state: ShanghaiState, slot: number): string {
  const turns = state.legs[0].turns.filter((t) => t.slot === slot);
  const darts = turns.reduce((s, t) => s + t.darts.length, 0);
  const marks = turns.reduce((s, t) => s + t.marks, 0);
  return darts ? ((marks / darts) * 3).toLocaleString('de-DE', { maximumFractionDigits: 2 }) : '—';
}

const targetLabel = (n: number) => (n === BULL ? 'Bull' : String(n));

/** Frage nach einem Shanghai (SPEC 7.3, Regel 5). Hervorgehoben ist die Wahl aus den Einstellungen. */
function ShanghaiQuestion({
  name,
  preferEnd,
  onEnd,
  onContinue,
  onUndo,
}: {
  name: string;
  preferEnd: boolean;
  onEnd: () => void;
  onContinue: () => void;
  onUndo: () => void;
}) {
  return (
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-label="Shanghai">
        <header class="modal-head">
          <h2>🎯 Shanghai!</h2>
        </header>
        <div class="modal-body">
          <p>{name} hat ein Shanghai geworfen. Spiel beenden oder weiterspielen?</p>
          <button class={preferEnd ? 'btn btn-primary' : 'btn'} onClick={onEnd}>
            Spiel beenden – {name} gewinnt
          </button>
          <button class={preferEnd ? 'btn' : 'btn btn-primary'} onClick={onContinue}>
            Weiterspielen
          </button>
          <button class="btn" onClick={onUndo}>
            ↶ Rückgängig (Dart falsch eingegeben)
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShanghaiGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeShanghai(shanghaiSetupOf(game), gameEvents), [game, gameEvents]);
  const s = state.setup.settings;
  const turn = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const round = turn?.turnIndex ?? state.next?.turnIndex ?? 1;
  const target = turn?.target ?? 1;
  const shanghaiBy = state.legs[0].state.shanghaiBy;

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      isTarget={(n) => n === target}
      scoreboard={
        <>
          <div class="round-head">
            Runde {Math.min(round, s.rounds)} / {s.rounds} · Ziel <strong>{targetLabel(target)}</strong>
          </div>
          <div class="scoreboard">
            {game.order.map((slot) => (
              <div
                key={slot}
                class={slot === activeSlot ? 'score-card active' : 'score-card'}
                style={{ borderColor: slot === activeSlot ? colorOf(slot) : undefined }}
              >
                <div class="score-name">
                  <span class="dot" style={{ background: colorOf(slot) }} /> {nameOf(slot)}
                </div>
                <div class="score-rest">{state.points[slot]}</div>
                <div class="score-meta">
                  MPR {mpr(state, slot)}
                  {shanghaiBy.includes(slot) ? ' · Shanghai!' : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      }
      turnDetails={
        <>
          <div class="calc">{turn && turn.darts.length ? `+${turn.points} · ${turn.marks} Marks` : ''}</div>
          {turn?.shanghai && <p class="banner">Shanghai!</p>}
        </>
      }
      blockConfirm={state.pendingDecision}
      overlay={(act) =>
        state.pendingDecision && turn ? (
          <ShanghaiQuestion
            name={nameOf(turn.slot)}
            preferEnd={s.endOnShanghai}
            onEnd={() => act(decideShanghai(state, true))}
            onContinue={() => act(decideShanghai(state, false))}
            onUndo={() => act(undoShanghai(state))}
          />
        ) : null
      }
      pillText={(d) => `${fieldLabel(d.field)} · ${d.scored}`}
      throwDart={(f) => throwShanghaiDart(state, f)}
      confirm={() => confirmShanghaiTurn(state)}
      undo={() => undoShanghai(state)}
      planEdit={(t, fields) => planShanghaiEdit(state, gameEvents, t, fields)}
      summary={(t) => `+${(t as ShanghaiTurn).points}`}
      endTable={
        <table class="table">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Punkte</th>
              <th>MPR</th>
              <th>Shanghai</th>
            </tr>
          </thead>
          <tbody>
            {game.order.map((slot) => (
              <tr key={slot}>
                <td>{nameOf(slot)}</td>
                <td>{state.points[slot]}</td>
                <td>{mpr(state, slot)}</td>
                <td>{shanghaiBy.includes(slot) ? 'ja' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}
