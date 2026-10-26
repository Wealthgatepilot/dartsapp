// Spielverlauf (Wunsch Gianluca, 26.10.2026): alle Spiele, filterbar nach Modus, Profil und Favoriten.
// Ein Spiel antippen öffnet seine Ansicht mit Ergebnis, Kennzahlen und Aufnahmen.

import { useMemo, useState } from 'preact/hooks';
import type { GameMode } from '../../engine/events';
import { favoritesOf } from '../../engine/favorites';
import { computeGame, gameTitle, listGames, type GameInfo } from '../../engine/games';
import { listTournaments } from '../../engine/tournament';
import { listProfiles, type Profile } from '../../engine/profiles';
import { TopBar } from '../components';
import { useAppData } from '../data';
import { participantName } from '../names';
import { href } from '../router';

const MODE_NAMES: Record<GameMode, string> = {
  x01: 'X01',
  cricket: 'Cricket',
  shanghai: 'Shanghai',
  countup: 'Count-Up',
  atc: 'Around the Clock',
  halveit: 'Halve-It',
  killer: 'Killer',
  doubles: 'Doppelfeld-Training',
  bobs: "Bob's 27",
  finish: '121',
  one21: '121 (alte Form)',
};

const PAGE = 30;

export function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Eine Zeile mit Titel, Zeit, Spielern, Ergebnis und Favoriten-Stern; antippen öffnet das Spiel. */
export function GameRow({ game, profiles, favorite }: { game: GameInfo; profiles: readonly Profile[]; favorite: boolean }) {
  const { events } = useAppData();
  const winners = game.ended === 'finished' ? (computeGame(game, events).state.matchWinners ?? []) : [];
  const names = game.created.participants.map((p) => participantName(p, profiles));
  // Turnierpartien mit Turniername (SPEC 8.5)
  const tag = game.created.tournament;
  const tournamentName = tag ? listTournaments(events).find((t) => t.created.tournamentId === tag.tournamentId)?.created.name : undefined;
  const winnerNames = game.created.participants.filter((p) => winners.includes(p.slot)).map((p) => participantName(p, profiles));
  const status = game.ended === 'abandoned' ? 'abgebrochen' : game.ended === null ? 'läuft' : winnerNames.length ? `🏆 ${winnerNames.join(', ')}` : '';
  return (
    <li class="list-row game-row">
      <a href={href({ name: 'review', gameId: game.created.gameId })}>
        <span class="game-row-main">
          <strong>
            {favorite ? '★ ' : ''}
            {gameTitle(game.created)}
          </strong>
          <span class="muted small">
            {formatWhen(game.createdAt)} · {names.join(', ')}
            {tournamentName ? ` · 🏅 ${tournamentName}` : ''}
          </span>
        </span>
        <span class="muted">{status}</span>
      </a>
    </li>
  );
}

export function History() {
  const { events } = useAppData();
  const profiles = useMemo(() => listProfiles(events), [events]);
  const games = useMemo(() => listGames(events).filter((g) => !g.hidden), [events]);
  const favorites = useMemo(() => favoritesOf(events), [events]);
  const [mode, setMode] = useState<GameMode | ''>('');
  const [profileId, setProfileId] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const modes = [...new Set(games.map((g) => g.created.mode))];
  const filtered = games.filter((g) => {
    if (mode && g.created.mode !== mode) return false;
    if (profileId && !g.created.participants.some((p) => p.profileId === profileId)) return false;
    if (onlyFav) {
      const fav = favorites.get(g.created.gameId);
      if (!fav?.size || (profileId && !fav.has(profileId))) return false;
    }
    return true;
  });
  const isFav = (g: GameInfo) => {
    const fav = favorites.get(g.created.gameId);
    return !!fav?.size && (!profileId || fav.has(profileId));
  };

  return (
    <div class="page">
      <TopBar title="Spielverlauf" back={href({ name: 'home' })} />

      <div class="filters">
        <select class="select" aria-label="Modus" value={mode} onChange={(e) => (setMode((e.target as HTMLSelectElement).value as GameMode | ''), setShown(PAGE))}>
          <option value="">Alle Modi</option>
          {modes.map((m) => (
            <option key={m} value={m}>
              {MODE_NAMES[m]}
            </option>
          ))}
        </select>
        <select
          class="select"
          aria-label="Profil"
          value={profileId}
          onChange={(e) => (setProfileId((e.target as HTMLSelectElement).value), setShown(PAGE))}
        >
          <option value="">Alle Spieler</option>
          {profiles
            .filter((p) => !p.archived)
            .map((p) => (
              <option key={p.profileId} value={p.profileId}>
                {p.name}
              </option>
            ))}
        </select>
        <button class={onlyFav ? 'chip on' : 'chip'} aria-pressed={onlyFav} onClick={() => (setOnlyFav(!onlyFav), setShown(PAGE))}>
          ★ Favoriten
        </button>
      </div>

      {filtered.length === 0 ? (
        <p class="muted">{games.length ? 'Keine Spiele für diese Auswahl.' : 'Noch keine Spiele.'}</p>
      ) : (
        <>
          <p class="muted small">{filtered.length === 1 ? '1 Spiel' : `${filtered.length} Spiele`}</p>
          <ul class="list">
            {filtered.slice(0, shown).map((g) => (
              <GameRow key={g.created.gameId} game={g} profiles={profiles} favorite={isFav(g)} />
            ))}
          </ul>
          {filtered.length > shown && (
            <button class="btn" onClick={() => setShown(shown + PAGE)}>
              Mehr anzeigen
            </button>
          )}
        </>
      )}
    </div>
  );
}
