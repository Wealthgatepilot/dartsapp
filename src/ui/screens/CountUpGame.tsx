// Count-Up-Ansicht (SPEC 7.10): Runde, Punkte und Average je Spieler.

import { useMemo } from 'preact/hooks';
import {
  computeCountUp,
  confirmCountUpTurn,
  countUpAverage,
  planCountUpEdit,
  throwCountUpDart,
  undoCountUp,
  type CountUpTurn,
} from '../../engine/countup';
import { countUpSetupOf } from '../../engine/games';
import { formatAverage } from '../../engine/stats';
import { fieldLabel } from '../../engine/types';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

export function CountUpGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeCountUp(countUpSetupOf(game), gameEvents), [game, gameEvents]);
  const rounds = state.setup.settings.rounds;
  const turn = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const round = turn?.turnIndex ?? state.next?.turnIndex ?? 1;

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      scoreboard={
        <>
          <div class="round-head">
            Runde <strong>{Math.min(round, rounds)}</strong> / {rounds}
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
                <div class="score-meta">Ø {formatAverage(countUpAverage(state, slot))}</div>
              </div>
            ))}
          </div>
        </>
      }
      turnDetails={<div class="calc">{turn && turn.darts.length ? `+${turn.points}` : ''}</div>}
      pillText={(d) => `${fieldLabel(d.field)} · ${d.scored}`}
      throwDart={(f, input) => throwCountUpDart(state, f, input)}
      confirm={() => confirmCountUpTurn(state)}
      undo={() => undoCountUp(state)}
      planEdit={(t, fields) => planCountUpEdit(state, gameEvents, t, fields)}
      summary={(t) => `+${(t as CountUpTurn).points}`}
      endTable={
        <table class="table">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Punkte</th>
              <th>Ø</th>
            </tr>
          </thead>
          <tbody>
            {game.order.map((slot) => (
              <tr key={slot}>
                <td>{nameOf(slot)}</td>
                <td>{state.points[slot]}</td>
                <td>{formatAverage(countUpAverage(state, slot))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}
