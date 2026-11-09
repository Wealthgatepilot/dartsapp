// Count-Up-Setup (SPEC 7.10): Spieler, Runden oder Zeit, Wertung gegeneinander oder zusammen, Regeln.

import { useState } from 'preact/hooks';
import { COUNTUP_MINUTES, DEFAULT_COUNTUP, MAX_COUNTUP_ROUNDS, validateCountUp, type CountUpSettings } from '../../engine/countup';
import type { StartMethod } from '../../engine/events';
import { countUpRules, countUpVariants } from '../../engine/rules';
import { RulesModal, Segmented, Stepper, TopBar } from '../components';
import { href } from '../router';
import { PlayerPicker, StartMethodSetting, useSavedSetup, useStartGame, type Pick } from '../setup';
import { StartButton } from './X01Setup';

interface SavedSetup {
  settings: CountUpSettings;
  picks: Pick[];
  start?: StartMethod;
}

export function CountUpSetup() {
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastCountUpSetup', { settings: DEFAULT_COUNTUP, picks: [] });
  const start = useStartGame();
  const [showRules, setShowRules] = useState(false);
  // Ältere gespeicherte Einstellungen kennen Zeit und Wertung noch nicht
  const s = { ...DEFAULT_COUNTUP, ...setup.settings };
  const set = (patch: Partial<CountUpSettings>) => setSetup((x) => ({ ...x, settings: { ...DEFAULT_COUNTUP, ...x.settings, ...patch } }));
  const errors = validateCountUp(s);
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    await start(setup.picks, { mode: 'countup', settings: s }, setup.start);
  };

  return (
    <div class="page">
      <TopBar
        title="Count-Up"
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
          <span>Begrenzung</span>
          <Segmented
            label="Begrenzung"
            value={s.limit ?? 'rounds'}
            options={[
              { value: 'rounds', label: 'Runden' },
              { value: 'time', label: 'Zeit' },
            ]}
            onChange={(limit) => set({ limit })}
          />
        </div>
        {s.limit === 'time' ? (
          <div class="setting">
            <span>Minuten</span>
            <Stepper
              label="Minuten"
              value={s.minutes ?? 60}
              min={COUNTUP_MINUTES.min}
              max={COUNTUP_MINUTES.max}
              step={COUNTUP_MINUTES.step}
              onChange={(minutes) => set({ minutes })}
            />
          </div>
        ) : (
          <div class="setting">
            <span>Runden</span>
            <Stepper label="Runden" value={s.rounds} min={1} max={MAX_COUNTUP_ROUNDS} onChange={(rounds) => set({ rounds })} />
          </div>
        )}
        {setup.picks.length > 1 && (
          <div class="setting">
            <span>Wertung</span>
            <Segmented
              label="Wertung"
              value={s.scoring ?? 'versus'}
              options={[
                { value: 'versus', label: 'gegeneinander' },
                { value: 'team', label: 'zusammen' },
              ]}
              onChange={(scoring) => set({ scoring })}
            />
          </div>
        )}
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && (
        <RulesModal title="Regeln: Count-Up" rules={countUpRules(s)} variants={countUpVariants()} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
