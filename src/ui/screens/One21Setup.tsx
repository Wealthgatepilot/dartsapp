// 121-Setup (SPEC 7.7): Spieler, Startziel, Darts pro Versuch, Out, nach Fehlschlag, Versuche, Regeln.

import { useState } from 'preact/hooks';
import type { StartMethod } from '../../engine/events';
import { DEFAULT_ONE21, ONE21_MAX, validateOne21, type One21Settings } from '../../engine/one21';
import { one21Rules, one21Variants } from '../../engine/rules';
import { RulesModal, Segmented, Stepper, TopBar } from '../components';
import { href } from '../router';
import { PlayerPicker, StartMethodSetting, useSavedSetup, useStartGame, type Pick } from '../setup';
import { StartButton } from './X01Setup';

interface SavedSetup {
  settings: One21Settings;
  picks: Pick[];
  start?: StartMethod;
}

export function One21Setup() {
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastOne21Setup', { settings: DEFAULT_ONE21, picks: [] });
  const start = useStartGame();
  const [showRules, setShowRules] = useState(false);
  const s = setup.settings;
  const set = (patch: Partial<One21Settings>) => setSetup((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const errors = validateOne21(s);
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    await start(setup.picks, { mode: 'one21', settings: s }, setup.start);
  };

  return (
    <div class="page">
      <TopBar
        title="121"
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
          <span>Startziel</span>
          <Stepper label="Startziel" value={s.startTarget} min={61} max={ONE21_MAX} onChange={(startTarget) => set({ startTarget })} />
        </div>
        <div class="setting">
          <span>Darts pro Versuch</span>
          <Segmented<One21Settings['dartsPerAttempt']>
            value={s.dartsPerAttempt}
            options={[
              { value: 3, label: '3' },
              { value: 6, label: '6' },
              { value: 9, label: '9' },
              { value: 12, label: '12' },
            ]}
            onChange={(dartsPerAttempt) => set({ dartsPerAttempt })}
          />
        </div>
        <div class="setting">
          <span>Out</span>
          <Segmented<One21Settings['outMode']>
            value={s.outMode}
            options={[
              { value: 'double', label: 'Double' },
              { value: 'master', label: 'Master' },
            ]}
            onChange={(outMode) => set({ outMode })}
          />
        </div>
        <div class="setting">
          <span>Nach Fehlschlag</span>
          <Segmented<One21Settings['afterFail']>
            value={s.afterFail}
            options={[
              { value: 'same', label: 'gleiches Ziel' },
              { value: 'down', label: 'Ziel −1' },
            ]}
            onChange={(afterFail) => set({ afterFail })}
          />
        </div>
        <div class="setting">
          <span>Versuche</span>
          <Stepper label="Versuche" value={s.attempts} min={1} max={50} onChange={(attempts) => set({ attempts })} />
        </div>
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && (
        <RulesModal title="Regeln: 121" rules={one21Rules(s)} variants={one21Variants()} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
