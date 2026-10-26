// Bob's 27 (SPEC 7.8): Punkte und Ziel je Spieler, Eingabe über Treffer/Falsch wie im Training.

import { useMemo } from 'preact/hooks';
import { BOBS_TARGETS, computeBobs, confirmBobsTurn, throwBobsDart, undoBobs, type BobsTurn } from '../../engine/bobs';
import { quote } from '../../engine/doubles';
import { bobsSetupOf } from '../../engine/games';
import { bobsMetrics } from '../../engine/metrics';
import { fieldLabel } from '../../engine/types';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function BobsGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeBobs(bobsSetupOf(game), gameEvents), [game, gameEvents]);
  const turn = state.currentTurn as BobsTurn | null;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const ls = state.legs[0].state;

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      scoreboard={
        <div class="scoreboard">
          {game.order.map((slot) => {
            const m = bobsMetrics(state, slot);
            const out = ls.out.includes(slot);
            return (
              <div
                key={slot}
                class={slot === activeSlot ? 'score-card active' : 'score-card'}
                style={{ borderColor: slot === activeSlot ? colorOf(slot) : undefined }}
              >
                <div class="score-name">
                  <span class="dot" style={{ background: colorOf(slot) }} /> {nameOf(slot)}
                </div>
                <div class="score-rest">{state.score[slot]}</div>
                <div class="score-meta">
                  {out ? 'ausgeschieden' : `${Math.min(ls.played[slot], BOBS_TARGETS.length)}/${BOBS_TARGETS.length} Ziele`} · Quote{' '}
                  {quote(m.hits, m.darts)}
                </div>
              </div>
            );
          })}
        </div>
      }
      turnDetails={
        <div class="calc">
          {turn && turn.darts.length
            ? turn.darts.length === 3 || turn.confirmed
              ? `${signed(turn.change)} Punkte`
              : `${turn.hits} Treffer`
            : ''}
        </div>
      }
      pillText={(d) => (d.hit ? `${fieldLabel(d.field)} ✓` : 'Falsch')}
      confirm={() => confirmBobsTurn(state)}
      undo={() => undoBobs(state)}
      hitMiss={{
        targetLabel: state.target ? fieldLabel(state.target) : '—',
        onHit: (input) => throwBobsDart(state, true, input),
        onMiss: (input) => throwBobsDart(state, false, input),
      }}
      endTable={
        <table class="table">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Punkte</th>
              <th>Treffer</th>
              <th>Quote</th>
            </tr>
          </thead>
          <tbody>
            {game.order.map((slot) => {
              const m = bobsMetrics(state, slot);
              return (
                <tr key={slot}>
                  <td>
                    {nameOf(slot)}
                    {ls.out.includes(slot) ? <span class="muted"> · raus</span> : null}
                  </td>
                  <td>{state.score[slot]}</td>
                  <td>
                    {m.hits}/{m.darts}
                  </td>
                  <td>{quote(m.hits, m.darts)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      }
    />
  );
}
