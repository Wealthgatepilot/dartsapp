// 121 (neue Form, Wunsch Gianluca): zufällige Restzahl je Runde, Versuche mit 6 bzw. 9 Darts,
// Checkout-Vorschlag wie bei X01, „Zahl überspringen“ vor einer Aufnahme.

import { useMemo } from 'preact/hooks';
import { formatCheckout, suggestCheckout } from '../../engine/checkout';
import {
  computeFinish,
  confirmFinishTurn,
  decideFinishEnd,
  planFinishEdit,
  skipFinish,
  throwFinishDart,
  undoFinish,
  type FinishState,
  type FinishTurn,
} from '../../engine/finish';
import { finishSetupOf } from '../../engine/games';
import { finishMetrics } from '../../engine/metrics';
import { fieldLabel, points } from '../../engine/types';
import type { ModeViewProps } from './Game';
import { EndQuestion, firstDoneQuestion } from './EndQuestion';
import { GameShell } from './GameShell';

export function FinishGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeFinish(finishSetupOf(game), gameEvents), [game, gameEvents]);
  const s = state.setup.settings;
  const turn = state.currentTurn as FinishTurn | null;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const isBot = game.created.participants.some((x) => x.slot === activeSlot && x.kind === 'bot');

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
            const done = p.round >= s.rounds;
            const r = p.results[p.round];
            const won = p.results.filter((x) => x.success).length;
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
                  {done ? 'fertig' : `Runde ${p.round + 1}/${s.rounds} · Versuch ${r.attempts}`} · {won} geschafft
                </div>
              </div>
            );
          })}
        </div>
      }
      turnDetails={<TurnInfo state={state} turn={turn} />}
      turnExtra={(act, busy) => (
        <button
            class="btn btn-small finish-skip"
            disabled={busy || isBot || !state.canSkip}
            onClick={() => {
              if (confirm('Diese Zahl überspringen? Sie zählt als nicht geschafft.')) act(skipFinish(state));
            }}
          >
            Überspringen
          </button>
      )}
      pillText={(d) => `${fieldLabel(d.field)} · ${points(d.field)}`}
      throwDart={(f, input) => throwFinishDart(state, f, input)}
      confirm={() => confirmFinishTurn(state)}
      undo={() => undoFinish(state, gameEvents)}
      planEdit={(t, fields) => planFinishEdit(state, gameEvents, t, fields)}
      summary={(t) => {
        const x = t as FinishTurn;
        return x.checkout ? `Checkout ${x.target}` : x.bust ? 'Bust' : `Rest ${x.endRest}`;
      }}
      blockConfirm={state.askEnd}
      overlay={(act) =>
        state.askEnd ? (
          <EndQuestion
            {...firstDoneQuestion(game.order.filter((slot) => state.players[slot].round >= s.rounds).map(nameOf))}
            onEnd={() => act(decideFinishEnd(state, true))}
            onContinue={() => act(decideFinishEnd(state, false))}
            onUndo={() => act(undoFinish(state, gameEvents))}
          />
        ) : null
      }
      endTable={<Results state={state} order={game.order} nameOf={nameOf} />}
    />
  );
}

/** Rechenzeile links, Checkout-Vorschlag rechts, darunter die übrigen Darts des Versuchs. */
function TurnInfo({ state, turn }: { state: FinishState; turn: FinishTurn | null }) {
  const pos = state.next;
  const p = pos ? state.players[pos.slot] : null;
  let line = '';
  if (turn && turn.darts.length) {
    if (turn.bust) line = `BUST · bleibt ${turn.startRest}`;
    else if (turn.checkout) line = `Geschafft: ${turn.target}!`;
    else line = `${turn.startRest} − ${turn.startRest - turn.endRest} = ${turn.endRest}`;
  } else if (p) {
    line = `Rest ${p.rest}`;
  }
  const r = p?.results[p.round];
  const dartsLeft = pos && r ? (r.target < 100 ? 6 : 9) - p!.turnsUsed * 3 - (pos.dartIndex - 1) : 0;
  const main = pos && p && turn?.bust !== true ? suggestCheckout(p.rest, 4 - pos.dartIndex, state.setup.settings.outMode, 'expert') : null;
  return (
    <div class="turn-info">
      <div class={turn?.bust ? 'calc calc-bust' : 'calc'}>
        {line}
        {pos && r && <div class="muted small">noch {dartsLeft} Darts im Versuch</div>}
      </div>
      {main && (
        <div class="checkout">
          <span class="checkout-main">{formatCheckout(main)}</span>
        </div>
      )}
    </div>
  );
}

/** Ergebnis je Spieler: geschafft, Darts, je Zahl mit Versuchen. */
function Results({ state, order, nameOf }: { state: FinishState; order: number[]; nameOf: (s: number) => string }) {
  return (
    <>
      <table class="table">
        <thead>
          <tr>
            <th>Spieler</th>
            <th>Geschafft</th>
            <th>Darts</th>
            <th>Ø je Finish</th>
          </tr>
        </thead>
        <tbody>
          {order.map((slot) => {
            const m = finishMetrics(state, slot);
            return (
              <tr key={slot}>
                <td>{nameOf(slot)}</td>
                <td>
                  {m.successes}/{state.setup.settings.rounds}
                </td>
                <td>{m.darts}</td>
                <td>{m.dartsPerFinish === null ? '—' : m.dartsPerFinish.toLocaleString('de-DE', { maximumFractionDigits: 1 })}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3 class="subhead">Zahlen</h3>
      <div class="results-scroll">
        <table class="table table-compact finish-rounds">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Zahl</th>
              <th>Versuche</th>
              <th>Darts</th>
            </tr>
          </thead>
          <tbody>
            {order.flatMap((slot) =>
              state.players[slot].results
                .filter((r) => r.success || r.skipped)
                .map((r, i) => (
                  <tr key={`${slot}-${i}`}>
                    <td>{nameOf(slot)}</td>
                    <td>{r.target}</td>
                    <td>{r.skipped ? 'übersprungen' : r.attempts}</td>
                    <td>{r.darts}</td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
