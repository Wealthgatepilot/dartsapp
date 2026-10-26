// Killer-Ansicht (SPEC 7.6): je Spieler Zahl, Leben und Killer-Status; Wirkung der Darts als Zeile.

import { useMemo } from 'preact/hooks';
import { killerSetupOf } from '../../engine/games';
import {
  computeKiller,
  confirmKillerTurn,
  planKillerEdit,
  randomKillerNumbers,
  throwKillerDart,
  undoKiller,
  type KillerEffect,
  type KillerTurn,
} from '../../engine/killer';
import { fieldLabel } from '../../engine/types';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';
import { cryptoRandom } from './KillerSetup';

const hearts = (n: number) => (n > 0 ? '♥'.repeat(n) : '—');

export function KillerGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeKiller(killerSetupOf(game), gameEvents), [game, gameEvents]);
  const s = state.setup.settings;
  const ls = state.legs[0].state;
  const turn = state.currentTurn as KillerTurn | null;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const targets = state.targetsFor(activeSlot);

  const effectText = (e: KillerEffect) =>
    e.kind === 'progress'
      ? `${nameOf(e.slot)} ${ls.progress[e.slot]}/${s.hitsToKiller}`
      : e.kind === 'killer'
        ? `${nameOf(e.slot)} ist Killer`
        : e.kind === 'life'
          ? `${nameOf(e.slot)} −1 Leben`
          : `${nameOf(e.slot)} raus`;

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      noBest
      prepareRematch={(c) =>
        // Revanche mit „zufällig“: neue Zahlen; selbst gewählte bleiben
        c.mode === 'killer' && c.settings.assignment === 'random'
          ? {
              ...c,
              settings: {
                ...c.settings,
                numbers: Object.fromEntries(randomKillerNumbers(c.participants.length, cryptoRandom).map((n, slot) => [slot, n])),
              },
            }
          : c
      }
      isTarget={(n) => targets.includes(n)}
      scoreboard={
        <div class="scoreboard">
          {game.order.map((slot) => {
            const out = ls.out.includes(slot);
            return (
              <div
                key={slot}
                class={slot === activeSlot ? 'score-card active' : out ? 'score-card killer-out' : 'score-card'}
                style={{ borderColor: slot === activeSlot ? colorOf(slot) : undefined }}
              >
                <div class="score-name">
                  <span class="dot" style={{ background: colorOf(slot) }} /> {nameOf(slot)}
                </div>
                <div class="score-rest">{s.numbers[slot]}</div>
                <div class="score-meta">
                  {out ? 'raus' : hearts(ls.lives[slot])}
                  {!out && (ls.killer[slot] ? ' · Killer' : ` · ${ls.progress[slot]}/${s.hitsToKiller}`)}
                </div>
              </div>
            );
          })}
        </div>
      }
      turnDetails={<div class="calc killer-effects">{turn?.effects.map(effectText).join(' · ') ?? ''}</div>}
      pillText={(d) => `${fieldLabel(d.field)}${d.scored ? ' ✓' : ''}`}
      throwDart={(f, input) => throwKillerDart(state, f, input)}
      confirm={() => confirmKillerTurn(state)}
      undo={() => undoKiller(state)}
      planEdit={(t, fields) => planKillerEdit(state, gameEvents, t, fields)}
      summary={(t) => (t as KillerTurn).effects.map(effectText).join(', ') || '—'}
      endTable={
        <table class="table">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Zahl</th>
              <th>Leben</th>
            </tr>
          </thead>
          <tbody>
            {game.order.map((slot) => (
              <tr key={slot}>
                <td>{nameOf(slot)}</td>
                <td>{s.numbers[slot]}</td>
                <td>{ls.out.includes(slot) ? 'raus' : ls.lives[slot]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}
