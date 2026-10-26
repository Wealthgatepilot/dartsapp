// Setup 121 (neue Form, Wunsch Gianluca): Spieler, Runden, dieselben oder eigene Zahlen, Out, Regeln.

import { useState } from 'preact/hooks';
import type { StartMethod } from '../../engine/events';
import { DEFAULT_FINISH, validateFinish, type FinishSettings } from '../../engine/finish';
import { finishRules, finishVariants } from '../../engine/rules';
import { RulesModal, Segmented, Stepper, TopBar } from '../components';
import { href } from '../router';
import { PlayerPicker, StartMethodSetting, useSavedSetup, useStartGame, type Pick } from '../setup';
import { StartButton } from './X01Setup';

interface SavedSetup {
  settings: FinishSettings;
  picks: Pick[];
  start?: StartMethod;
}

export function FinishSetup() {
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastFinishSetup', { settings: DEFAULT_FINISH, picks: [] });
  const start = useStartGame();
  const [showRules, setShowRules] = useState(false);
  const s = setup.settings;
  const set = (patch: Partial<FinishSettings>) => setSetup((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const errors = validateFinish(s);
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    await start(setup.picks, { mode: 'finish', settings: s }, setup.start);
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
          <span>Runden (Zahlen)</span>
          <Stepper label="Runden" value={s.rounds} min={1} max={50} onChange={(rounds) => set({ rounds })} />
        </div>
        <div class="setting">
          <span>Zahlen</span>
          <Segmented<FinishSettings['sequence']>
            value={s.sequence}
            options={[
              { value: 'shared', label: 'für alle gleich' },
              { value: 'own', label: 'jeder eigene' },
            ]}
            onChange={(sequence) => set({ sequence })}
          />
        </div>
        <div class="setting">
          <span>Out</span>
          <Segmented<FinishSettings['outMode']>
            value={s.outMode}
            options={[
              { value: 'double', label: 'Double' },
              { value: 'master', label: 'Master' },
            ]}
            onChange={(outMode) => set({ outMode })}
          />
        </div>
        <p class="muted small">Zufällige Restzahlen 70–170. Unter 100: 6 Darts je Versuch, ab 100: 9 Darts.</p>
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && <RulesModal title="Regeln: 121" rules={finishRules(s)} variants={finishVariants()} onClose={() => setShowRules(false)} />}
    </div>
  );
}
