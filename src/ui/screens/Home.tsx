import { useMemo, useState } from 'preact/hooks';
import { computeGame, gameTitle, listGames, unfinishedGame } from '../../engine/games';
import { listProfiles } from '../../engine/profiles';
import { isInstalled } from '../../data/persist';
import { BACKUP_REMINDER_DAYS, daysSince, exportBackup } from '../backup';
import { useAppData } from '../data';
import { participantName } from '../names';
import { usePwa } from '../pwa';
import { href, navigate } from '../router';
import { lastBackupText } from './BackupCard';

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);
}

export function Home() {
  const { events, append, store, lastBackupAt, reload } = useAppData();
  const [snoozed, setSnoozed] = useState(false);
  const pwa = usePwa();
  const installed = isInstalled();
  const [hideInstallHint, setHideInstallHint] = useState(() => {
    try {
      return localStorage.getItem('hideInstallHint') === '1';
    } catch {
      return false;
    }
  });
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

      {pwa.needRefresh && (
        <section class="card card-accent">
          <p>Eine neue Version der App ist da.</p>
          <button class="btn btn-primary" onClick={pwa.update}>
            Jetzt neu laden
          </button>
        </section>
      )}

      {!installed && !hideInstallHint && (
        <section class="card card-warn">
          <h2>App installieren</h2>
          <p>
            {isIos()
              ? 'Tippe in Safari auf „Teilen“ (Quadrat mit Pfeil) und dann auf „Zum Home-Bildschirm“.'
              : 'Tippe im Browser-Menü (⋮) auf „App installieren“ oder „Zum Startbildschirm hinzufügen“.'}
          </p>
          <p class="small">
            Wichtig: Was du hier im Browser spielst, ist in der installierten App nicht zu sehen. Beide haben einen eigenen
            Speicher.
          </p>
          <button
            class="btn btn-small"
            onClick={() => {
              setHideInstallHint(true);
              try {
                localStorage.setItem('hideInstallHint', '1');
              } catch {
                // ohne Browser-Speicher erscheint der Hinweis eben wieder
              }
            }}
          >
            Ausblenden
          </button>
        </section>
      )}

      {pwa.offlineReady && (
        <p class="small muted" onClick={pwa.dismissOfflineReady}>
          ✓ Die App funktioniert jetzt auch ohne Internet.
        </p>
      )}

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
            {gameTitle(running.created)} ·{' '}
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

      <h2 class="section-title">Spiele</h2>
      <nav class="menu">
        <a class="menu-item menu-main" href={href({ name: 'setup' })}>
          <strong>X01</strong>
          <span class="muted">301, 501, 701 oder frei</span>
        </a>
        <a class="menu-item menu-main" href={href({ name: 'cricket' })}>
          <strong>Cricket</strong>
          <span class="muted">Standard oder Cut-Throat</span>
        </a>
        <a class="menu-item menu-main" href={href({ name: 'shanghai' })}>
          <strong>Shanghai</strong>
          <span class="muted">Runde für Runde auf ein Ziel</span>
        </a>
        <a class="menu-item menu-main" href={href({ name: 'countup' })}>
          <strong>Count-Up</strong>
          <span class="muted">Punkte sammeln, keine Abzüge</span>
        </a>
        <a class="menu-item menu-main" href={href({ name: 'atc' })}>
          <strong>Around the Clock</strong>
          <span class="muted">1 bis 20 der Reihe nach</span>
        </a>
        <a class="menu-item menu-main" href={href({ name: 'halveit' })}>
          <strong>Halve-It</strong>
          <span class="muted">Daneben halbiert die Punkte</span>
        </a>
      </nav>

      <h2 class="section-title">Training</h2>
      <nav class="menu">
        <a class="menu-item menu-main" href={href({ name: 'doubles' })}>
          <strong>Doppelfeld-Training</strong>
          <span class="muted">D1–D20 und Bullseye in zufälliger Folge</span>
        </a>
        <a class="menu-item menu-main" href={href({ name: 'bobs' })}>
          <strong>Bob's 27</strong>
          <span class="muted">Alle Doubles, Punkte gegen dich</span>
        </a>
        <a class="menu-item menu-main" href={href({ name: 'one21' })}>
          <strong>121</strong>
          <span class="muted">Checkouts mit festen Darts</span>
        </a>
      </nav>

      <h2 class="section-title">Mehr</h2>
      <nav class="menu">
        <a class="menu-item" href={href({ name: 'stats' })}>
          <strong>Statistik</strong>
          <span class="muted">Verlauf, Heatmap, Doppelquote</span>
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
              const winners = computeGame(g, events).state.matchWinners ?? [];
              const names = g.created.participants
                .filter((p) => winners.includes(p.slot))
                .map((p) => participantName(p, profiles));
              return (
                <li key={g.created.gameId} class="list-row">
                  <span>
                    {gameTitle(g.created)} · {g.created.participants.map((p) => participantName(p, profiles)).join(', ')}
                  </span>
                  <span class="muted">{names.length ? `🏆 ${names.join(', ')}` : ''}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
