// 121-Ansicht (SPEC 7.7): Ziel und Rest je Spieler, Versuch und übrige Darts, Checkout-Vorschlag wie bei X01.

import { useMemo } from 'preact/hooks';
import { formatCheckout, suggestCheckout } from '../../engine/checkout';
import { one21SetupOf } from '../../engine/games';
import {
  computeOne21,
  confirmOne21Turn,
  dartsLeftInAttempt,
  planOne21Edit,
  throwOne21Dart,
  undoOne21,
  type One21State,
  type One21Turn,
} from '../../engine/one21';
import { fieldLabel, points } from '../../engine/types';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

export function One21Game({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeOne21(one21SetupOf(game), gameEvents), [game, gameEvents]);
  const s = state.setup.settings;
  const turn = state.currentTurn as One21Turn | null;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];

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
            const p = state.players[slot];
            const done = p.attemptsDone >= s.attempts;
            return (
              <div
                key={slot}
                class={slot === activeSlot ? 'score-card active' : 'score-card'}
                style={{ borderColor: slot === activeSlot ? colorOf(slot) : undefined }}
              >
                <div class="score-name">
                  <span class="dot" style={{ background: colorOf(slot) }} /> {nameOf(slot)}
                </div>
                <div class="score-rest">{done ? '✓' : p.rest}</div>
                <div class="score-meta">
                  {done ? 'fertig' : `Ziel ${p.target} · Versuch ${p.attemptsDone + 1}/${s.attempts}`}
                </div>
                <div class="score-meta">
                  {p.successes} geschafft{p.highest !== null ? ` · bestes ${p.highest}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      }
      turnDetails={<TurnInfo state={state} turn={turn} />}
      pillText={(d) => `${fieldLabel(d.field)} · ${points(d.field)}`}
      throwDart={(f) => throwOne21Dart(state, f)}
      confirm={() => confirmOne21Turn(state)}
      undo={() => undoOne21(state)}
      planEdit={(t, fields) => planOne21Edit(state, gameEvents, t, fields)}
      summary={(t) => {
        const x = t as One21Turn;
        return x.checkout ? `Checkout ${x.target}` : x.bust ? 'Bust' : `Rest ${x.endRest}`;
      }}
      endTable={
        <table class="table">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Bestes Ziel</th>
              <th>Geschafft</th>
            </tr>
          </thead>
          <tbody>
            {game.order.map((slot) => {
              const p = state.players[slot];
              return (
                <tr key={slot}>
                  <td>{nameOf(slot)}</td>
                  <td>{p.highest ?? '—'}</td>
                  <td>
                    {p.successes}/{p.attemptsDone}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      }
    />
  );
}

/** Rechenzeile links, Checkout-Vorschlag rechts (wie X01), dazu die übrigen Darts des Versuchs. */
function TurnInfo({ state, turn }: { state: One21State; turn: One21Turn | null }) {
  const pos = state.next;
  let line = '';
  if (turn && turn.darts.length) {
    if (turn.bust) line = `BUST · bleibt ${turn.startRest}`;
    else if (turn.checkout) line = `Checkout ${turn.target}!`;
    else line = `${turn.startRest} − ${turn.startRest - turn.endRest} = ${turn.endRest}`;
  } else if (pos) {
    line = `Rest ${state.players[pos.slot].rest}`;
  }
  const main =
    pos && turn?.bust !== true
      ? suggestCheckout(state.players[pos.slot].rest, 4 - pos.dartIndex, state.setup.settings.outMode, 'expert')
      : null;
  return (
    <div class="turn-info">
      <div class={turn?.bust ? 'calc calc-bust' : 'calc'}>
        {line}
        {pos && <div class="muted small">noch {dartsLeftInAttempt(state, pos.slot, pos.dartIndex)} Darts im Versuch</div>}
      </div>
      {main && (
        <div class="checkout">
          <span class="checkout-main">{formatCheckout(main)}</span>
        </div>
      )}
    </div>
  );
}
