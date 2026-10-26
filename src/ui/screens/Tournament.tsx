// Turnier-Übersicht und Turnierliste (SPEC 8.5): Baum bzw. Tabelle mit Spielplan, Partien starten,
// Stechen nach Gleichstand, Computer-Partien automatisch ausspielen.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { autoPlayGame, isBotDuel, simulateBulloff } from '../../engine/autoplay';
import { cryptoRandom } from '../../engine/bulloff';
import { gameEventsOf, type GameCreatedPayload, type NewAppEvent, type Participant } from '../../engine/events';
import { gameTitle, listGames } from '../../engine/games';
import { listProfiles, type Profile } from '../../engine/profiles';
import {
  computeTournament,
  listTournaments,
  matchGame,
  participantOf,
  type Entrant,
  type MatchView,
  type StandingRow,
  type TournamentState,
} from '../../engine/tournament';
import { uuidv7 } from '../../data/ids';
import { TopBar } from '../components';
import { useAppData } from '../data';
import { participantColor, participantName } from '../names';
import { href, navigate } from '../router';
import { Bulloff } from './StartOrder';

/** Namen der Teilnehmer; gleiche Namen (z. B. zwei „Computer 6“) bekommen eine Nummer. */
function entrantNames(entrants: readonly Entrant[], profiles: readonly Profile[]): Map<string, string> {
  const base = entrants.map((e) => participantName(participantOf(e, 0), profiles));
  const count = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const b of base) count.set(b, (count.get(b) ?? 0) + 1);
  return new Map(
    entrants.map((e, i) => {
      const b = base[i];
      if (count.get(b)! < 2) return [e.id, b];
      const n = (seen.get(b) ?? 0) + 1;
      seen.set(b, n);
      return [e.id, `${b} (${n})`];
    }),
  );
}

const FORMAT_LABEL = { ko: 'K.-o.', league: 'Jeder gegen jeden', groups: 'Gruppen + K.-o.' };

// ---------- Liste ----------

export function Tournaments() {
  const { events } = useAppData();
  const profiles = useMemo(() => listProfiles(events), [events]);
  const list = useMemo(() => listTournaments(events), [events]);
  const games = useMemo(() => listGames(events), [events]);
  return (
    <div class="page">
      <TopBar title="Turniere" back={href({ name: 'home' })} />
      <a class="btn btn-primary btn-wide" href={href({ name: 'tournamentNew' })}>
        + Neues Turnier
      </a>
      {list.length === 0 && <p class="muted">Noch keine Turniere.</p>}
      <ul class="list">
        {list.map((info) => {
          const s = computeTournament(info, games, events);
          const names = entrantNames(info.created.entrants, profiles);
          const status =
            info.ended === 'abandoned'
              ? 'abgebrochen'
              : s.podium.length
                ? `🏆 ${names.get(s.podium[0])}`
                : `läuft · ${s.matches.filter((m) => m.status === 'done' && m.result?.gameId).length} von ${s.matches.filter((m) => !(m.a === 'bye' || m.b === 'bye')).length} Partien`;
          return (
            <li key={info.created.tournamentId} class="list-row game-row">
              <a href={href({ name: 'tournament', tournamentId: info.created.tournamentId })}>
                <span class="game-row-main">
                  <strong>{info.created.name}</strong>
                  <span class="muted small">
                    {FORMAT_LABEL[info.created.format.kind]} · {info.created.entrants.length} Teilnehmer
                  </span>
                </span>
                <span class="small">{status}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Übersicht ----------

export function TournamentView({ tournamentId }: { tournamentId: string }) {
  const { events, append } = useAppData();
  const profiles = useMemo(() => listProfiles(events), [events]);
  const info = useMemo(() => listTournaments(events).find((t) => t.created.tournamentId === tournamentId), [events, tournamentId]);
  const games = useMemo(() => listGames(events), [events]);
  const state = useMemo(() => (info ? computeTournament(info, games, events) : null), [info, games, events]);
  const [tiebreak, setTiebreak] = useState<MatchView | null>(null);
  const busy = useRef(false);

  const t = state?.created;
  const names = useMemo(() => (t ? entrantNames(t.entrants, profiles) : new Map<string, string>()), [t, profiles]);
  const entrant = (id: string) => t!.entrants.find((e) => e.id === id)!;

  // Computer gegen Computer sofort ausspielen, auch ein nötiges Stechen; am Ende das Turnier als beendet markieren
  useEffect(() => {
    if (!state || state.ended || busy.current) return;
    const duel = state.matches.find(
      (m) => (m.status === 'ready' || m.status === 'tiebreak') && typeof m.a === 'string' && typeof m.b === 'string' && isBot(m.a) && isBot(m.b),
    );
    const run = async (evs: NewAppEvent[]) => {
      busy.current = true;
      try {
        await append(evs);
      } finally {
        busy.current = false;
      }
    };
    if (duel && duel.status === 'ready') {
      const created = matchGame(state.created, duel, uuidv7(), Date.now());
      if (isBotDuel(created)) run([{ type: 'game.created', payload: created }, ...autoPlayGame(created, cryptoRandom)]);
      return;
    }
    if (duel && duel.status === 'tiebreak' && duel.gameId) {
      const players = [participantOf(entrant(duel.a as string), 0), participantOf(entrant(duel.b as string), 1)];
      const b = simulateBulloff(players, `${duel.gameId}:stechen`, cryptoRandom);
      run([...b.events, tiebreakEvent(state, duel, b.order[0])]);
      return;
    }
    if (state.complete) run([{ type: 'tournament.ended', payload: { tournamentId, reason: 'finished' } }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state || !t) {
    return (
      <div class="page">
        <TopBar title="Turnier" back={href({ name: 'tournaments' })} />
        <p>Dieses Turnier gibt es nicht.</p>
      </div>
    );
  }

  function isBot(id: string) {
    return entrant(id).kind === 'bot';
  }

  const nameOf = (id: string | 'bye' | null) => (id === 'bye' ? 'Freilos' : id === null ? 'offen' : (names.get(id) ?? '?'));

  const start = async (m: MatchView) => {
    if (busy.current || state.ended) return;
    const gameId = uuidv7();
    const created = matchGame(t, m, gameId, Date.now());
    busy.current = true;
    try {
      await append([
        { type: 'game.created', payload: created },
        ...(created.start === 'asEntered' || !created.start
          ? [{ type: 'game.orderDecided' as const, payload: { gameId, order: [0, 1], method: 'asEntered' as const } }]
          : []),
      ]);
    } finally {
      busy.current = false;
    }
    navigate({ name: 'game', gameId });
  };

  const abandon = async () => {
    if (!confirm('Turnier abbrechen? Gespielte Partien bleiben gespeichert und in der Statistik.')) return;
    await append([{ type: 'tournament.ended', payload: { tournamentId, reason: 'abandoned' } }]);
  };

  if (tiebreak?.gameId) {
    const players: Participant[] = [participantOf(entrant(tiebreak.a as string), 0), participantOf(entrant(tiebreak.b as string), 1)];
    const bullId = `${tiebreak.gameId}:stechen`;
    return (
      <div class="page start-order">
        <TopBar
          title="Stechen: Ausbullen"
          back={href({ name: 'tournament', tournamentId })}
          right={
            <button class="btn btn-small" onClick={() => setTiebreak(null)}>
              Zurück
            </button>
          }
        />
        <p class="small">
          Gleichstand: <strong>{nameOf(tiebreak.a)}</strong> gegen <strong>{nameOf(tiebreak.b)}</strong>. Näher an der Mitte gewinnt.
        </p>
        <Bulloff
          participants={players}
          bullId={bullId}
          gameEvents={gameEventsOf(events, bullId)}
          nameOf={(slot) => nameOf(slot === 0 ? tiebreak.a : tiebreak.b)}
          colorOf={(slot) => participantColor(players[slot], profiles)}
          decide={(order) => {
            setTiebreak(null);
            return [tiebreakEvent(state, tiebreak, order[0])];
          }}
          doneLabel="Ergebnis übernehmen"
        />
      </div>
    );
  }

  const open = state.matches.filter((m) => m.status === 'ready' || m.status === 'playing' || m.status === 'tiebreak');
  const koMatches = state.matches.filter((m) => m.def.stage === 'ko');
  const tableMatches = state.matches.filter((m) => m.def.stage !== 'ko');

  return (
    <div class="page tournament">
      <TopBar
        title={t.name}
        back={href({ name: 'tournaments' })}
        right={
          !state.ended && (
            <button class="btn btn-small" onClick={abandon}>
              Abbrechen
            </button>
          )
        }
      />
      <p class="muted small">
        {gameTitle({ ...t, gameId: '', participants: [], seed: 0 } as GameCreatedPayload)} · {FORMAT_LABEL[t.format.kind]} ·{' '}
        {t.entrants.length} Teilnehmer
      </p>

      {state.podium.length > 0 && (
        <section class="card card-accent">
          <h2>🏆 {nameOf(state.podium[0])} gewinnt das Turnier</h2>
          {state.podium.length > 1 && (
            <ol class="ranking small-ranking">
              {state.podium.slice(1, 4).map((id, i) => (
                <li key={id} value={i + 2}>
                  {nameOf(id)}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {state.ended === 'abandoned' && <p class="card card-warn">Dieses Turnier wurde abgebrochen.</p>}

      {!state.ended && open.length > 0 && (
        <section class="card">
          <h2>Nächste Partien</h2>
          <ul class="list">
            {open.map((m) => (
              <MatchRow key={m.def.id} m={m} nameOf={nameOf} label={matchLabel(m, state)} onStart={start} onTiebreak={setTiebreak} />
            ))}
          </ul>
        </section>
      )}

      {state.tables.map((table, gi) => (
        <section class="card" key={gi}>
          <h2>{t.format.kind === 'groups' ? `Gruppe ${String.fromCharCode(65 + gi)}` : 'Tabelle'}</h2>
          <Standings rows={table} nameOf={nameOf} advance={t.format.kind === 'groups' ? t.format.advance : 0} />
          <details class="history">
            <summary>Spielplan</summary>
            <ul class="list">
              {tableMatches
                .filter((m) => (t.format.kind === 'groups' ? m.def.group === gi + 1 : true))
                .map((m) => (
                  <MatchRow key={m.def.id} m={m} nameOf={nameOf} label={`Runde ${m.def.round}`} onStart={start} onTiebreak={setTiebreak} />
                ))}
            </ul>
          </details>
        </section>
      ))}

      {koMatches.length > 0 && (
        <section class="card">
          <h2>K.-o.-Runde</h2>
          <Bracket matches={koMatches} state={state} nameOf={nameOf} />
        </section>
      )}
    </div>
  );
}

function tiebreakEvent(state: TournamentState, m: MatchView, winnerSlot: number): NewAppEvent {
  return {
    type: 'tournament.tiebreak',
    payload: {
      tournamentId: state.created.tournamentId,
      matchId: m.def.id,
      gameId: m.gameId!,
      winner: (winnerSlot === 0 ? m.a : m.b) as string,
    },
  };
}

/** Name einer K.-o.-Runde vom Finale aus gezählt. */
function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return 'Finale';
  if (fromEnd === 1) return 'Halbfinale';
  if (fromEnd === 2) return 'Viertelfinale';
  if (fromEnd === 3) return 'Achtelfinale';
  return `Runde ${round}`;
}

function matchLabel(m: MatchView, state: TournamentState): string {
  if (m.def.thirdPlace) return 'Spiel um Platz 3';
  if (m.def.stage === 'ko') return roundName(m.def.round, state.plan.koRounds);
  if (m.def.stage === 'group') return `Gruppe ${String.fromCharCode(64 + (m.def.group ?? 1))} · Runde ${m.def.round}`;
  return `Runde ${m.def.round}`;
}

function MatchRow({
  m,
  nameOf,
  label,
  onStart,
  onTiebreak,
}: {
  m: MatchView;
  nameOf: (id: string | 'bye' | null) => string;
  label: string;
  onStart: (m: MatchView) => void;
  onTiebreak: (m: MatchView) => void;
}) {
  const r = m.result;
  const strongA = r && r.winner === m.a;
  const strongB = r && r.winner === m.b;
  return (
    <li class="list-row match-row">
      <span class="game-row-main">
        <span class="muted small">{label}</span>
        <span>
          <span class={strongA ? 'leg-won' : ''}>{nameOf(m.a)}</span> – <span class={strongB ? 'leg-won' : ''}>{nameOf(m.b)}</span>
        </span>
      </span>
      {m.status === 'done' && r?.gameId && (
        <a class="btn btn-small" href={href({ name: 'review', gameId: r.gameId })}>
          {r.legsA}:{r.legsB}
        </a>
      )}
      {m.status === 'done' && !r?.gameId && <span class="muted small">Freilos</span>}
      {m.status === 'ready' && (
        <button class="btn btn-small btn-primary" onClick={() => onStart(m)}>
          Spielen
        </button>
      )}
      {m.status === 'playing' && m.gameId && (
        <a class="btn btn-small btn-primary" href={href({ name: 'game', gameId: m.gameId })}>
          Weiterspielen
        </a>
      )}
      {m.status === 'tiebreak' && (
        <button class="btn btn-small btn-primary" onClick={() => onTiebreak(m)}>
          Ausbullen
        </button>
      )}
      {m.status === 'waiting' && <span class="muted small">wartet</span>}
    </li>
  );
}

function Standings({ rows, nameOf, advance }: { rows: StandingRow[]; nameOf: (id: string) => string; advance: number }) {
  return (
    <div class="results-fit">
      <table class="table table-compact standings">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Sp</th>
            <th>S</th>
            <th>N</th>
            <th>Legs</th>
            <th>+/−</th>
            <th>P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} class={i < advance ? 'advance' : ''}>
              <td>{i + 1}</td>
              <td class="standings-name">{nameOf(r.id)}</td>
              <td>{r.played}</td>
              <td>{r.won}</td>
              <td>{r.lost}</td>
              <td>
                {r.legsFor}:{r.legsAgainst}
              </td>
              <td>{r.legsFor - r.legsAgainst > 0 ? `+${r.legsFor - r.legsAgainst}` : r.legsFor - r.legsAgainst}</td>
              <td>
                <strong>{r.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Turnierbaum: Runden nebeneinander, waagerecht scrollbar. */
function Bracket({ matches, state, nameOf }: { matches: MatchView[]; state: TournamentState; nameOf: (id: string | 'bye' | null) => string }) {
  const rounds = state.plan.koRounds;
  return (
    <div class="bracket">
      {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
        <div class="bracket-round" key={round}>
          <h3 class="muted small">{roundName(round, rounds)}</h3>
          {matches
            .filter((m) => m.def.round === round && !m.def.thirdPlace)
            .map((m) => (
              <BracketMatch key={m.def.id} m={m} nameOf={nameOf} />
            ))}
          {round === rounds &&
            matches
              .filter((m) => m.def.thirdPlace)
              .map((m) => (
                <div key={m.def.id}>
                  <h3 class="muted small">Platz 3</h3>
                  <BracketMatch m={m} nameOf={nameOf} />
                </div>
              ))}
        </div>
      ))}
    </div>
  );
}

function BracketMatch({ m, nameOf }: { m: MatchView; nameOf: (id: string | 'bye' | null) => string }) {
  const r = m.result;
  const side = (id: string | 'bye' | null, legs: number | null) => (
    <div class={`bracket-side${r && r.winner === id ? ' won' : ''}${id === 'bye' || id === null ? ' muted' : ''}`}>
      <span class="bracket-name">{nameOf(id)}</span>
      {legs !== null && <span class="bracket-legs">{legs}</span>}
    </div>
  );
  const played = !!r?.gameId;
  const box = (
    <>
      {side(m.a, played ? r!.legsA : null)}
      {side(m.b, played ? r!.legsB : null)}
    </>
  );
  return played ? (
    <a class="bracket-match" href={href({ name: 'review', gameId: r!.gameId! })}>
      {box}
    </a>
  ) : (
    <div class={`bracket-match${m.status === 'playing' ? ' playing' : ''}`}>{box}</div>
  );
}
