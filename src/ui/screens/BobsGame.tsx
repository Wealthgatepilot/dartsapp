// Bob's 27 (SPEC 7.8): Punkte und Ziel je Spieler, Eingabe über Treffer/Falsch wie im Training.

import { useMemo } from 'preact/hooks';
import { BOBS_TARGETS, computeBobs, confirmBobsTurn, throwBobsDart, undoBobs, type BobsTurn } from '../../engine/bobs';
import { quote } from '../../engine/doubles';
import { bobsSetupOf } from '../../engine/games';
import { bobsMetrics } from '../../engine/metrics';
import { fieldLabel } from '../../engine/types';
import { type Block, PlayerBlocks } from '../blocks';
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
        <PlayerBlocks
          activeSlot={activeSlot}
          blocks={game.order.map((slot): Block => {
            const m = bobsMetrics(state, slot);
            const out = ls.out.includes(slot);
            const played = Math.min(ls.played[slot], BOBS_TARGETS.length);
            const done = played >= BOBS_TARGETS.length;
            return {
              slot,
              name: nameOf(slot),
              color: colorOf(slot),
              big: String(state.score[slot]),
              badge: out ? '✕' : done ? '✓' : fieldLabel(BOBS_TARGETS[played]),
              badgeLabel: out ? 'ausgeschieden' : 'Ziel',
              dim: out,
              pages: [
                [
                  { label: 'Ziele', value: out ? 'ausgeschieden' : `${played}/${BOBS_TARGETS.length}` },
                  { label: 'Getroffen', value: `${m.hits} / ${m.darts}` },
                  { label: 'Quote', value: quote(m.hits, m.darts) },
                ],
              ],
            };
          })}
        />
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
