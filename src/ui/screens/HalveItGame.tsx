// Halve-It-Ansicht (SPEC 7.9): Runde und Ziel, Punkte je Spieler, Halbieren sichtbar.

import { useMemo } from 'preact/hooks';
import { halveItSetupOf } from '../../engine/games';
import {
  computeHalveIt,
  confirmHalveItTurn,
  halveIsTarget,
  halveTargetName,
  planHalveItEdit,
  throwHalveItDart,
  undoHalveIt,
  type HalveItTurn,
} from '../../engine/halveit';
import { fieldLabel } from '../../engine/types';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

const targetLong = (t: Parameters<typeof halveTargetName>[0]) =>
  t === 'D' ? 'beliebiges Double' : t === 'T' ? 'beliebiges Triple' : halveTargetName(t);

export function HalveItGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeHalveIt(halveItSetupOf(game), gameEvents), [game, gameEvents]);
  const targets = state.setup.settings.targets;
  const turn = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const round = turn?.turnIndex ?? state.next?.turnIndex ?? 1;
  const target = state.target ?? turn?.target ?? targets[targets.length - 1];

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      isTarget={(n) => halveIsTarget(target, n)}
      scoreboard={
        <>
          <div class="round-head">
            Runde {Math.min(round, targets.length)} / {targets.length} · Ziel <strong>{targetLong(target)}</strong>
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
              </div>
            ))}
          </div>
        </>
      }
      turnDetails={
        <div class={turn?.halved ? 'calc calc-bust' : 'calc'}>
          {turn && turn.darts.length ? (turn.halved ? `Halbiert: ${turn.before} → ${state.points[turn.slot]}` : `+${turn.points}`) : ''}
        </div>
      }
      pillText={(d) => `${fieldLabel(d.field)} · ${d.scored}`}
      throwDart={(f) => throwHalveItDart(state, f)}
      confirm={() => confirmHalveItTurn(state)}
      undo={() => undoHalveIt(state)}
      planEdit={(t, fields) => planHalveItEdit(state, gameEvents, t, fields)}
      summary={(t) => ((t as HalveItTurn).halved ? 'halbiert' : `+${(t as HalveItTurn).points}`)}
      endTable={
        <table class="table">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Punkte</th>
              <th>Halbiert</th>
            </tr>
          </thead>
          <tbody>
            {game.order.map((slot) => (
              <tr key={slot}>
                <td>{nameOf(slot)}</td>
                <td>{state.points[slot]}</td>
                <td>{state.legs[0].turns.filter((t) => t.slot === slot && t.halved).length}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}
