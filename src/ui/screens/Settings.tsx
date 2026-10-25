import { isInstalled } from '../../data/persist';
import { TopBar } from '../components';
import { useAppData } from '../data';
import { href } from '../router';

const PERSIST_TEXT = {
  granted: 'gewährt – der Browser räumt die Daten nicht von selbst.',
  denied: 'nicht gewährt – bei Speichermangel könnte der Browser Daten löschen. Regelmäßig sichern!',
  unsupported: 'wird von diesem Browser nicht unterstützt. Regelmäßig sichern!',
};

export function Settings() {
  const { events, store, persist } = useAppData();
  const installed = isInstalled();
  return (
    <div class="page">
      <TopBar title="Einstellungen" back={href({ name: 'home' })} />

      <section class="card">
        <h2>Speicher</h2>
        <p>
          <strong>Dauerhafter Speicher:</strong> {persist ? PERSIST_TEXT[persist] : 'wird geprüft …'}
        </p>
        <p>
          <strong>Installiert:</strong>{' '}
          {installed
            ? 'ja, als App auf dem Home-Bildschirm.'
            : 'nein, im Browser geöffnet. Daten im Browser und in der installierten App sind getrennt.'}
        </p>
        <p class="muted small">
          {events.length} gespeicherte Ereignisse · Gerät {store.deviceId.slice(0, 8)}
        </p>
        <p class="muted small">Daten sichern und laden kommt im nächsten Schritt.</p>
      </section>

      <section class="card">
        <h2>Board</h2>
        <a class="btn" href={href({ name: 'boardtest' })}>
          Board ausprobieren
        </a>
      </section>

      <p class="muted small">Version {__APP_VERSION__}</p>
    </div>
  );
}
