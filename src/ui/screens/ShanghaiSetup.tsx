// Shanghai-Setup (SPEC 7.3): Spieler, Startzahl, Rundenzahl, „Shanghai beendet das Spiel“, Regeln.

import { useState } from 'preact/hooks';
import { shanghaiRules } from '../../engine/rules';
import { DEFAULT_SHANGHAI, maxRounds, validateShanghai, type ShanghaiSettings } from '../../engine/shanghai';
import { Modal, Segmented, Stepper, TopBar } from '../components';
import { href } from '../router';
import { PlayerPicker, StartMethodSetting, useSavedSetup, useStartGame, type Pick } from '../setup';
import type { StartMethod } from '../../engine/events';
import { StartButton } from './X01Setup';

interface SavedSetup {
  settings: ShanghaiSettings;
  picks: Pick[];
  start?: StartMethod;
}

export function ShanghaiSetup() {
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastShanghaiSetup', { settings: DEFAULT_SHANGHAI, picks: [] });
  const start = useStartGame();
  const [showRules, setShowRules] = useState(false);
  const s = setup.settings;
  const set = (patch: Partial<ShanghaiSettings>) =>
    setSetup((x) => {
      const settings = { ...x.settings, ...patch };
      // Rundenzahl passt sich an, wenn die Startzahl steigt
      return { ...x, settings: { ...settings, rounds: Math.min(settings.rounds, maxRounds(settings.startNumber)) } };
    });
  const errors = validateShanghai(s);
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    await start(setup.picks, { mode: 'shanghai', settings: s }, setup.start);
  };

  return (
    <div class="page">
      <TopBar
        title="Shanghai"
        back={href({ name: 'home' })}
        right={
          <button class="btn btn-small" onClick={() => setShowRules(true)}>
            Regeln
          </button>
        }
      />

      <PlayerPicker picks={setup.picks} onChange={(update) => setSetup((x) => ({ ...x, picks: update(x.picks) }))} />

      <section class="card">
        <h2>Einstellungen</h2>
        <StartMethodSetting
          value={setup.start ?? 'asEntered'}
          players={setup.picks.length}
          onChange={(start) => setSetup((x) => ({ ...x, start }))}
        />
        <div class="setting">
          <span>Startzahl</span>
          <Stepper label="Startzahl" value={s.startNumber} min={1} max={20} onChange={(startNumber) => set({ startNumber })} />
        </div>
        <div class="setting">
          <span>Runden</span>
          <Stepper
            label="Runden"
            value={s.rounds}
            min={1}
            max={maxRounds(s.startNumber)}
            onChange={(rounds) => set({ rounds })}
          />
        </div>
        <div class="setting">
          <span>Shanghai beendet das Spiel</span>
          <Segmented
            value={s.endOnShanghai ? 'ja' : 'nein'}
            options={[
              { value: 'ja', label: 'ja' },
              { value: 'nein', label: 'nein' },
            ]}
            onChange={(v) => set({ endOnShanghai: v === 'ja' })}
          />
        </div>
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && (
        <Modal title="Regeln: Shanghai" onClose={() => setShowRules(false)}>
          {shanghaiRules(s).map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Modal>
      )}
    </div>
  );
}
