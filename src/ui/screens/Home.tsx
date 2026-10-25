import { useMemo, useState } from 'preact/hooks';
import { BACKUP_REMINDER_DAYS, daysSince, exportBackup } from '../backup';
import { lastBackupText } from './BackupCard';
import { listGames, unfinishedGame, x01SetupOf } from '../../engine/games';
import { listProfiles } from '../../engine/profiles';
import { gameEventsOf } from '../../engine/events';
import { computeX01 } from '../../engine/x01';
import { useAppData } from '../data';
import { participantName } from '../names';
import { href, navigate } from '../router';

export function Home() {
  const { events, append, store, lastBackupAt, reload } = useAppData();
  const [snoozed, setSnoozed] = useState(false);
  const profiles = useMemo(() => listProfiles(events), [events]);
  const running = useMemo(() => unfinishedGame(events), [events]);
  const recent = useMemo(() => listGames(events).filter((g) => g.ended === 'finished' && !g.hidden).slice(0, 5), [events]);

  // Erinnerung nach beendeten Spielen, wenn die letzte Sicherung 7 Tage oder länger her ist (SPEC 13.3).
  const age = daysSince(lastBackupAt);
  const remind = !snoozed && recent.length > 0 && (age === null || age >= BACKUP_REMINDER_DAYS);

  const abandon = async () => {
    if (!running) return;
    if (!confirm('Laufendes Spiel abbrechen? Es bleibt gespeichert, zählt aber nicht als beendet.')) return;
    await append([{ type: 'game.ended', payload: { gameId: running.created.gameId, reason: 'abandoned' } }]);
  };

  return (
    <div class="page">
      <header class="home-head">
        <h1>Darts</h1>
        <a class="btn-icon" href={href({ name: 'settings' })} aria-label="Einstellungen">
          ⚙
        </a>
      </header>

      {remind && (
        <section class="card card-warn">
          <p>
            Letzte Sicherung: <strong>{lastBackupText(lastBackupAt)}</strong>. Jetzt sichern?
          </p>
          <div class="row">
            <button
              class="btn btn-primary"
              onClick={async () => {
                await exportBackup(store);
                await reload();
              }}
            >
              Jetzt sichern
            </button>
            <button class="btn" onClick={() => setSnoozed(true)}>
              Später
            </button>
          </div>
        </section>
      )}

      {running && (
        <section class="card card-accent">
          <h2>Spiel fortsetzen?</h2>
          <p>
            {running.created.settings.startScore} ·{' '}
            {running.created.participants.map((p) => participantName(p, profiles)).join(' gegen ')}
          </p>
          <div class="row">
            <button class="btn btn-primary" onClick={() => navigate({ name: 'game', gameId: running.created.gameId })}>
              Fortsetzen
            </button>
            <button class="btn" onClick={abandon}>
              Abbrechen
            </button>
          </div>
        </section>
      )}

      <nav class="menu">
        <a class="menu-item menu-main" href={href({ name: 'setup' })}>
          <strong>X01</strong>
          <span class="muted">301, 501, 701 oder frei</span>
        </a>
        <a class="menu-item" href={href({ name: 'profiles' })}>
          <strong>Profile</strong>
          <span class="muted">{profiles.filter((p) => !p.archived).length} Spieler</span>
        </a>
      </nav>

      {recent.length > 0 && (
        <section>
          <h2 class="section-title">Letzte Spiele</h2>
          <ul class="list">
            {recent.map((g) => {
              const st = computeX01(x01SetupOf(g), gameEventsOf(events, g.created.gameId));
              const winner = g.created.participants.find((p) => p.slot === st.matchWinner);
              return (
                <li key={g.created.gameId} class="list-row">
                  <span>
                    {g.created.settings.startScore} ·{' '}
                    {g.created.participants.map((p) => participantName(p, profiles)).join(', ')}
                  </span>
                  <span class="muted">{winner ? `🏆 ${participantName(winner, profiles)}` : ''}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
