// Rückblick auf ein Spiel aus dem Spielverlauf (Wunsch Gianluca, 26.10.2026): Ergebnis wie am Spielende,
// Kennzahlen je Profil, alle Aufnahmen und Favoriten-Sterne je Profil.

import { useMemo } from 'preact/hooks';
import type { DartView, TurnBase } from '../../engine/core';
import type { NewAppEvent } from '../../engine/events';
import { favoritesOf, toggleFavorite } from '../../engine/favorites';
import { gameTitle } from '../../engine/games';
import { METRICS, legRecords } from '../../engine/records';
import type { Mode } from '../../engine/metrics';
import { TopBar } from '../components';
import { useAppData } from '../data';
import { href } from '../router';
import type { ShellProps } from './GameShell';
import { formatWhen } from './History';
import { fmtMetric } from './Stats';

export function GameReview({ shell: p, act }: { shell: ShellProps; act: (evs: readonly NewAppEvent[]) => Promise<void> }) {
  const { events } = useAppData();
  const { game, state } = p;
  const gameId = game.created.gameId;
  const favorites = useMemo(() => favoritesOf(events), [events]);
  const records = useMemo(() => legRecords(events).filter((r) => r.gameId === gameId), [events, gameId]);
  const defs = METRICS[game.created.mode as Mode] ?? [];
  const profileParts = game.created.participants.filter((x) => x.kind === 'profile' && x.profileId);
  const winners = state.matchWinners ?? [];
  const status =
    game.ended === 'abandoned'
      ? 'Abgebrochen'
      : state.finished
        ? winners.length > 1
          ? `Gleichstand: ${winners.map(p.nameOf).join(', ')}`
          : winners.length
            ? `🏆 ${p.nameOf(winners[0])} gewinnt`
            : 'Beendet'
        : 'Läuft noch';

  return (
    <div class="page review">
      <TopBar title={gameTitle(game.created)} back={href({ name: 'history' })} />

      <section class="card">
        <p>
          <strong>{status}</strong>
        </p>
        <p class="muted small">
          {formatWhen(game.createdAt)} · {game.order.map(p.nameOf).join(', ')}
        </p>
        {!state.finished && game.ended === null && (
          <a class="btn btn-primary" href={href({ name: 'game', gameId })}>
            Weiterspielen
          </a>
        )}
        {profileParts.length > 0 && (
          <div class="chips review-favs">
            {profileParts.map((x) => {
              const on = favorites.get(gameId)?.has(x.profileId!) ?? false;
              return (
                <button
                  key={x.slot}
                  class={on ? 'chip on' : 'chip'}
                  aria-pressed={on}
                  aria-label={`Favorit von ${p.nameOf(x.slot)}`}
                  onClick={() => act([toggleFavorite(favorites, gameId, x.profileId!)])}
                >
                  {on ? '★' : '☆'} {p.nameOf(x.slot)}
                </button>
              );
            })}
          </div>
        )}
        {profileParts.length > 0 && <p class="muted small">Stern antippen: Spiel als Favorit dieses Spielers merken.</p>}
      </section>

      <section class="card">
        <h2>Ergebnis</h2>
        {p.scoreboard}
        {p.endTable}
      </section>

      {defs.length > 0 && records.length > 0 && (
        <section class="card">
          <h2>Kennzahlen</h2>
          {[...new Set(records.map((r) => r.leg))].map((legNo) => {
            const row = records.filter((r) => r.leg === legNo);
            return (
              <div key={legNo} class="results-scroll">
                {records.some((r) => r.leg > 1) && <h3 class="subhead">Leg {legNo}</h3>}
                <table class="table table-compact review-metrics">
                  <thead>
                    <tr>
                      <th>Kennzahl</th>
                      {row.map((r) => (
                        <th key={r.slot}>{p.nameOf(r.slot)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {defs
                      .filter((d) => row.some((r) => r.values[d.key] !== undefined))
                      .map((d) => (
                        <tr key={d.key}>
                          <td>{d.label}</td>
                          {row.map((r) => (
                            <td key={r.slot}>{fmtMetric(d, r.values[d.key])}</td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          <p class="muted small">Gäste und Computer haben keine Kennzahlen.</p>
        </section>
      )}

      <section class="card">
        <h2>Aufnahmen</h2>
        {state.legs.map((leg) =>
          leg.turns.length ? (
            <div key={leg.leg}>
              {state.legs.length > 1 && <h3 class="subhead">Leg {leg.leg}</h3>}
              <ol class="review-turns">
                {leg.turns.map((t: TurnBase) => (
                  <li key={`${t.slot}-${t.turnIndex}`}>
                    <span class="review-who">
                      {p.nameOf(t.slot)} · {t.turnIndex}
                    </span>
                    <span class="review-darts">{t.darts.map((d: DartView) => p.pillText(d)).join(' / ')}</span>
                    {p.summary && <strong class="review-sum">{p.summary(t)}</strong>}
                  </li>
                ))}
              </ol>
            </div>
          ) : null,
        )}
      </section>
    </div>
  );
}
