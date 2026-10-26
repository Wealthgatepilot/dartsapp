// Around-the-Clock-Ansicht (SPEC 7.5): aktuelles Ziel je Spieler, nur das Ziel des Werfers ist farbig.

import { useMemo } from 'preact/hooks';
import { computeAtc, confirmAtcTurn, planAtcEdit, throwAtcDart, undoAtc, type AtcTurn } from '../../engine/atc';
import { atcSetupOf } from '../../engine/games';
import { atcMetrics } from '../../engine/metrics';
import { BULL, fieldLabel } from '../../engine/types';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

const targetName = (n: number | null) => (n === null ? '✓' : n === BULL ? 'Bull' : String(n));
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`);

export function AtcGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeAtc(atcSetupOf(game), gameEvents), [game, gameEvents]);
  const turn = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const target = state.targetOf(activeSlot);
  const total = state.targets.length;

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      isTarget={(n) => n === target}
      scoreboard={
        <div class="scoreboard">
          {game.order.map((slot) => {
            const m = atcMetrics(state, slot);
            const done = state.legs[0].state.index[slot];
            return (
              <div
                key={slot}
                class={slot === activeSlot ? 'score-card active' : 'score-card'}
                style={{ borderColor: slot === activeSlot ? colorOf(slot) : undefined }}
              >
                <div class="score-name">
                  <span class="dot" style={{ background: colorOf(slot) }} /> {nameOf(slot)}
                </div>
                <div class="score-rest">{targetName(state.targetOf(slot))}</div>
                <div class="score-meta">
                  {done}/{total} geschafft · {m.darts} Darts · {pct(m.hitRate)}
                </div>
              </div>
            );
          })}
        </div>
      }
      turnDetails={
        <div class="calc">{turn && turn.darts.length ? `${turn.hits} Treffer` : ''}</div>
      }
      pillText={(d) => `${fieldLabel(d.field)}${d.scored ? ' ✓' : ''}`}
      throwDart={(f, input) => throwAtcDart(state, f, input)}
      confirm={() => confirmAtcTurn(state)}
      undo={() => undoAtc(state)}
      planEdit={(t, fields) => planAtcEdit(state, gameEvents, t, fields)}
      summary={(t) => `${(t as AtcTurn).hits} Treffer`}
      endTable={
        <table class="table">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Geschafft</th>
              <th>Darts</th>
              <th>Quote</th>
            </tr>
          </thead>
          <tbody>
            {game.order.map((slot) => {
              const m = atcMetrics(state, slot);
              return (
                <tr key={slot}>
                  <td>{nameOf(slot)}</td>
                  <td>
                    {state.legs[0].state.index[slot]}/{total}
                  </td>
                  <td>{m.darts}</td>
                  <td>{pct(m.hitRate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      }
    />
  );
}
