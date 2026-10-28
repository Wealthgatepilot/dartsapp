// Doppelfeld-Training (SPEC 7.4): Ziel je Spieler, Darts aufs Ziel und gesamt, Quote bei Treffer und gesamt, Eingabe über drei Flächen.

import { useMemo } from 'preact/hooks';
import {
  computeDoubles,
  confirmDoublesTurn,
  currentTarget,
  decideDoublesEnd,
  quote,
  targetsOf,
  throwDoublesDart,
  undoDoubles,
  type DoublesState,
} from '../../engine/doubles';
import { doublesSetupOf } from '../../engine/games';
import { fieldLabel } from '../../engine/types';
import { type Block, PlayerBlocks } from '../blocks';
import { EndQuestion, firstDoneQuestion } from './EndQuestion';
import type { ModeViewProps } from './Game';
import { GameShell } from './GameShell';

export function DoublesGame({ game, gameEvents, nameOf, colorOf }: ModeViewProps) {
  const state = useMemo(() => computeDoubles(doublesSetupOf(game), gameEvents), [game, gameEvents]);
  const turn = state.currentTurn;
  const activeSlot = state.next?.slot ?? turn?.slot ?? game.order[0];
  const target = currentTarget(state.players[activeSlot]);

  return (
    <GameShell
      game={game}
      gameEvents={gameEvents}
      state={state}
      nameOf={nameOf}
      colorOf={colorOf}
      scoreboard={<Cards state={state} order={game.order} activeSlot={activeSlot} nameOf={nameOf} colorOf={colorOf} />}
      turnDetails={<History state={state} slot={activeSlot} />}
      pillText={(d) => (d.hit ? `${fieldLabel(d.field)} ✓` : 'Falsch')}
      confirm={() => confirmDoublesTurn(state)}
      undo={() => undoDoubles(state, gameEvents)}
      blockConfirm={state.askEnd}
      overlay={(act) =>
        state.askEnd ? (
          <EndQuestion
            {...firstDoneQuestion(game.order.filter((slot) => !currentTarget(state.players[slot])).map(nameOf))}
            onEnd={() => act(decideDoublesEnd(state, true))}
            onContinue={() => act(decideDoublesEnd(state, false))}
            onUndo={() => act(undoDoubles(state, gameEvents))}
          />
        ) : null
      }
      hitMiss={{
        targetLabel: target ? fieldLabel(target) : '—',
        onHit: (input) => throwDoublesDart(state, true, input),
        onMiss: (input) => throwDoublesDart(state, false, input),
      }}
      endTable={<Results state={state} order={game.order} nameOf={nameOf} colorOf={colorOf} />}
    />
  );
}

function Cards({
  state,
  order,
  activeSlot,
  nameOf,
  colorOf,
}: {
  state: DoublesState;
  order: number[];
  activeSlot: number;
  nameOf: (s: number) => string;
  colorOf: (s: number) => string;
}) {
  const blocks: Block[] = order.map((slot) => {
    const p = state.players[slot];
    const t = currentTarget(p);
    const onTarget = t ? (p.stats[fieldLabel(t)] ?? { darts: 0, hits: 0 }) : null;
    return {
      slot,
      name: nameOf(slot),
      color: colorOf(slot),
      big: t ? fieldLabel(t) : '✓',
      badge: String(p.index),
      badgeLabel: 'Felder geschafft',
      pages: [
        [
          { label: 'Ziel', value: `${Math.min(p.index + 1, p.sequence.length)}/${p.sequence.length}` },
          { label: t ? `Darts auf ${fieldLabel(t)}` : 'Darts auf Ziel', value: t ? String(p.dartsOnTarget) : '—' },
          { label: 'Darts gesamt', value: String(p.darts) },
          // Quote auf dem aktuellen Ziel, falls der nächste Dart trifft
          { label: 'Bei Treffer', value: onTarget ? quote(onTarget.hits + 1, onTarget.darts + 1) : '—' },
          { label: 'Quote', value: quote(p.hits, p.darts) },
        ],
      ],
    };
  });
  return <PlayerBlocks blocks={blocks} activeSlot={activeSlot} />;
}

/** Die letzten Ziele des Spielers mit den nötigen Darts (wie die Verlaufstabelle in App 2). */
function History({ state, slot }: { state: DoublesState; slot: number }) {
  const last = state.players[slot].history.slice(-4).reverse();
  if (!last.length) return null;
  return (
    <div class="history-line small muted">
      {last.map((h) => `${fieldLabel(h.target)}: ${h.darts} ${h.darts === 1 ? 'Dart' : 'Darts'}`).join(' · ')}
    </div>
  );
}

/**
 * Ergebnis je Spieler und Feld (SPEC 7.4, Regel 7). Bei vielen Feldern zwei Tabellen: im Querformat
 * nebeneinander, im Hochformat untereinander wie eine (Wunsch Gianluca: alles ohne Scrollen sehen).
 *//** Ergebnis am Ende (SPEC 7.4 Regel 8): je Spieler eine Karte, darunter je Ziel eine Kachel mit Balken. */
function Results({
  state,
  order,
  nameOf,
  colorOf,
}: {
  state: DoublesState;
  order: number[];
  nameOf: (s: number) => string;
  colorOf: (s: number) => string;
}) {
  const keys = targetsOf(state.setup.settings).map(fieldLabel);
  const fixed = state.setup.settings.mode.kind === 'fixed';
  const p = (slot: number) => state.players[slot];
  // Platz wie beim Sieger: bis zum Treffer mehr Ziele, dann weniger Darts; feste Zahl meiste Treffer
  const score = (slot: number) => (fixed ? p(slot).hits : p(slot).index * 1_000_000 - p(slot).darts);
  const ranked = [...order].sort((a, b) => score(b) - score(a));
  const place = (slot: number) => 1 + ranked.filter((s) => score(s) > score(slot)).length;
  const rate = (st?: { hits: number; darts: number }) => (st && st.darts ? st.hits / st.darts : null);
  /** Stärkstes bzw. schwächstes Feld (bei Gleichstand bis zu drei, dann „+ n“). */
  const extreme = (slot: number, pick: (a: number, b: number) => number) => {
    const rated = keys.map((k) => [k, rate(p(slot).stats[k])] as const).filter((x): x is readonly [string, number] => x[1] !== null);
    if (!rated.length) return '—';
    const best = rated.reduce((m, [, r]) => pick(m, r), rated[0][1]);
    const fields = rated.filter(([, r]) => r === best).map(([k]) => k);
    const shown = fields.length > 3 ? `${fields.slice(0, 3).join(', ')} + ${fields.length - 3}` : fields.join(', ');
    return `${shown} · ${quote(best * 1000, 1000)}`;
  };
  return (
    <div class="dres">
      <div class="dres-cards">
        {ranked.map((slot) => {
          const pl = p(slot);
          return (
            <div key={slot} class={place(slot) === 1 ? 'dres-card win' : 'dres-card'} style={{ borderColor: place(slot) === 1 ? colorOf(slot) : undefined }}>
              <div class="dres-head">
                <span class="dot" style={{ background: colorOf(slot) }} /> {nameOf(slot)} · {place(slot)}.
              </div>
              <div class="dres-big">{quote(pl.hits, pl.darts)}</div>
              <div class="dres-kv">
                <span>Treffer / Darts</span>
                <b>
                  {pl.hits} / {pl.darts}
                </b>
              </div>
              <div class="dres-kv">
                <span>Ø Darts je Doppel</span>
                <b>{pl.hits ? (pl.darts / pl.hits).toLocaleString('de-DE', { maximumFractionDigits: 1 }) : '—'}</b>
              </div>
              <div class="dres-kv">
                <span>Stärkstes</span>
                <b>{extreme(slot, Math.max)}</b>
              </div>
              <div class="dres-kv">
                <span>Schwächstes</span>
                <b>{extreme(slot, Math.min)}</b>
              </div>
            </div>
          );
        })}
      </div>
      <div class="dres-grid">
        {keys.map((key) => {
          const rates = order.map((slot) => rate(p(slot).stats[key]));
          const top = Math.max(...rates.map((r) => r ?? -1));
          const alone = rates.filter((r) => r === top).length === 1;
          return (
            <div key={key} class="dres-tile">
              <b class="dres-field">{key}</b>
              {order.map((slot, i) => {
                const st = p(slot).stats[key];
                const r = rates[i];
                return (
                  <div key={slot} class={r !== null && r === top && alone && order.length > 1 ? 'dres-row best' : 'dres-row'}>
                    <span class="dot" style={{ background: colorOf(slot) }} />
                    <span class="dres-bar">
                      <i style={{ width: `${(r ?? 0) * 100}%`, background: colorOf(slot) }} />
                    </span>
                    <span>
                      {st ? quote(st.hits, st.darts) : '—'} {st && <small>{st.hits}/{st.darts}</small>}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p class="muted small">Balken = Quote auf dem Feld · klein: Treffer/Darts · fett = besser auf diesem Feld · „—“ = Feld nicht erreicht</p>
    </div>
  );
}
