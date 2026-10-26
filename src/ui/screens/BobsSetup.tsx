// Setup Bob's 27 (SPEC 7.8): Spieler, „Bei 0 oder weniger ausscheiden“, Regeln.

import { useState } from 'preact/hooks';
import { DEFAULT_BOBS, type BobsSettings } from '../../engine/bobs';
import type { StartMethod } from '../../engine/events';
import { bobsRules, bobsVariants } from '../../engine/rules';
import { RulesModal, Segmented, TopBar } from '../components';
import { href } from '../router';
import { PlayerPicker, StartMethodSetting, useSavedSetup, useStartGame, type Pick } from '../setup';
import { StartButton } from './X01Setup';

interface SavedSetup {
  settings: BobsSettings;
  picks: Pick[];
  start?: StartMethod;
}

export function BobsSetup() {
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastBobsSetup', { settings: DEFAULT_BOBS, picks: [] });
  const start = useStartGame();
  const [showRules, setShowRules] = useState(false);
  const s = setup.settings;
  const errors: string[] = [];
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    await start(setup.picks, { mode: 'bobs', settings: s }, setup.start);
  };

  return (
    <div class="page">
      <TopBar
        title="Bob's 27"
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
          <span>Bei 0 oder weniger ausscheiden</span>
          <Segmented
            value={s.dieAtZero ? 'ja' : 'nein'}
            options={[
              { value: 'ja', label: 'ja' },
              { value: 'nein', label: 'nein' },
            ]}
            onChange={(v) => setSetup((x) => ({ ...x, settings: { dieAtZero: v === 'ja' } }))}
          />
        </div>
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && (
        <RulesModal title="Regeln: Bob's 27" rules={bobsRules(s)} variants={bobsVariants()} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
