// Around-the-Clock-Setup (SPEC 7.5): Spieler, Ziele, Ring, Sprünge, Regeln.

import { useState } from 'preact/hooks';
import { DEFAULT_ATC, type AtcSettings } from '../../engine/atc';
import type { StartMethod } from '../../engine/events';
import { atcRules, atcVariants } from '../../engine/rules';
import { RulesModal, Segmented, TopBar } from '../components';
import { href } from '../router';
import { PlayerPicker, StartMethodSetting, useSavedSetup, useStartGame, type Pick } from '../setup';
import { StartButton } from './X01Setup';

interface SavedSetup {
  settings: AtcSettings;
  picks: Pick[];
  start?: StartMethod;
}

export function AtcSetup() {
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastAtcSetup', { settings: DEFAULT_ATC, picks: [] });
  const start = useStartGame();
  const [showRules, setShowRules] = useState(false);
  const s = setup.settings;
  const set = (patch: Partial<AtcSettings>) => setSetup((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const errors: string[] = [];
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    // Sprünge gibt es nur bei Ring „beliebig“
    await start(setup.picks, { mode: 'atc', settings: { ...s, jumps: s.ring === 'any' && s.jumps } }, setup.start);
  };

  return (
    <div class="page">
      <TopBar
        title="Around the Clock"
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
          <span>Ziele</span>
          <Segmented
            value={s.withBull ? 'bull' : '20'}
            options={[
              { value: '20', label: '1–20' },
              { value: 'bull', label: '1–20 + Bull' },
            ]}
            onChange={(v) => set({ withBull: v === 'bull' })}
          />
        </div>
        <div class="setting">
          <span>Ring</span>
          <Segmented<AtcSettings['ring']>
            value={s.ring}
            options={[
              { value: 'any', label: 'beliebig' },
              { value: 'double', label: 'Doubles' },
              { value: 'triple', label: 'Triples' },
            ]}
            onChange={(ring) => set({ ring })}
          />
        </div>
        {s.ring === 'any' && (
          <div class="setting">
            <span>Sprünge</span>
            <Segmented
              label="Sprünge"
              value={s.jumps ? 'an' : 'aus'}
              options={[
                { value: 'aus', label: 'aus' },
                { value: 'an', label: 'an' },
              ]}
              onChange={(v) => set({ jumps: v === 'an' })}
            />
          </div>
        )}
        {s.ring === 'any' && (
          <p class="muted small">Sprünge: Ein Double bringt dich 2 Ziele weiter, ein Triple 3. Singles zählen wie immer 1.</p>
        )}
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && (
        <RulesModal title="Regeln: Around the Clock" rules={atcRules(s)} variants={atcVariants()} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
