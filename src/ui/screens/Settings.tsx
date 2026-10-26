import { isInstalled } from '../../data/persist';
import { Segmented, TopBar } from '../components';
import { useAppData } from '../data';
import { href } from '../router';
import { speechSupported, useSpeechEnabled } from '../speech';
import { type Theme, useTheme } from '../theme';
import { BackupCard } from './BackupCard';

const PERSIST_TEXT = {
  granted: 'gewährt – der Browser räumt die Daten nicht von selbst.',
  denied: 'nicht gewährt – bei Speichermangel könnte der Browser Daten löschen. Regelmäßig sichern!',
  unsupported: 'wird von diesem Browser nicht unterstützt. Regelmäßig sichern!',
};

export function Settings() {
  const { events, store, persist } = useAppData();
  const installed = isInstalled();
  const [speechOn, setSpeechOn] = useSpeechEnabled();
  const [theme, setTheme] = useTheme();
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
      </section>

      <BackupCard />

      <section class="card">
        <h2>Aussehen</h2>
        <div class="setting">
          <span>Farben</span>
          <Segmented
            label="Aussehen"
            value={theme}
            options={[
              { value: 'kreide', label: 'Kreidegrau' },
              { value: 'dunkel', label: 'Dunkel' },
            ]}
            onChange={(v) => setTheme(v as Theme)}
          />
        </div>
      </section>

      <section class="card">
        <h2>Sprachausgabe</h2>
        <div class="setting">
          <span>Punkte ansagen</span>
          <Segmented
            label="Sprachausgabe"
            value={speechOn ? 'an' : 'aus'}
            options={[
              { value: 'an', label: 'an' },
              { value: 'aus', label: 'aus' },
            ]}
            onChange={(v) => setSpeechOn(v === 'an')}
          />
        </div>
        <p class="muted small">
          {speechSupported()
            ? 'Nach jedem „Weiter“ sagt das Gerät die Punkte an, bei X01 auch, was der Nächste zum Checken braucht. Im Spiel schaltet 🔊 oben die Ansagen an oder aus.'
            : 'Dieser Browser kann nicht sprechen.'}
        </p>
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
