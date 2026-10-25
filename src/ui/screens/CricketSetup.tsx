// Cricket-Setup (SPEC 7.2): Spieler, Zielzahlen, Trefferzahl, Variante, Legs/Sets, Regeln.

import { useState } from 'preact/hooks';
import { DEFAULT_CRICKET, validateCricket, type CricketSettings } from '../../engine/cricket';
import { cricketRules } from '../../engine/rules';
import { BULL } from '../../engine/types';
import { Modal, Segmented, Stepper, TopBar } from '../components';
import { href } from '../router';
import { LegsSets, PlayerPicker, useSavedSetup, useStartGame, type Pick } from '../setup';
import { StartButton } from './X01Setup';

interface SavedSetup {
  settings: CricketSettings;
  picks: Pick[];
}

const ALL_TARGETS = [...Array.from({ length: 20 }, (_, i) => 20 - i), BULL];

export function CricketSetup() {
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastCricketSetup', { settings: DEFAULT_CRICKET, picks: [] });
  const start = useStartGame();
  const [showRules, setShowRules] = useState(false);
  const s = setup.settings;
  const set = (patch: Partial<CricketSettings>) => setSetup((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const errors = validateCricket(s);
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');

  // Zielzahlen in Board-Reihenfolge von hoch nach niedrig, Bull am Ende
  const toggleTarget = (n: number) => {
    const next = s.targets.includes(n) ? s.targets.filter((x) => x !== n) : [...s.targets, n];
    set({ targets: ALL_TARGETS.filter((x) => next.includes(x)) });
  };

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    await start(setup.picks, { mode: 'cricket', settings: s });
  };

  return (
    <div class="page">
      <TopBar
        title="Cricket"
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
        <div class="setting">
          <span>Variante</span>
          <Segmented
            value={s.variant}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'cutthroat', label: 'Cut-Throat' },
            ]}
            onChange={(variant) => set({ variant })}
          />
        </div>
        <div class="setting">
          <span>Treffer bis zu</span>
          <Stepper label="Treffer" value={s.closeAt} min={1} max={9} onChange={(closeAt) => set({ closeAt })} />
        </div>
        <div class="field">
          <span>Zielzahlen</span>
          <div class="chips">
            {ALL_TARGETS.map((n) => (
              <button
                key={n}
                class={s.targets.includes(n) ? 'chip chip-num on' : 'chip chip-num'}
                onClick={() => toggleTarget(n)}
                aria-pressed={s.targets.includes(n)}
              >
                {n === BULL ? 'Bull' : n}
              </button>
            ))}
          </div>
          <button class="btn btn-small" onClick={() => set({ targets: DEFAULT_CRICKET.targets })}>
            Standard: 15–20 und Bull
          </button>
        </div>
        <LegsSets legs={s.legs} sets={s.sets} onChange={(v) => set(v)} />
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && (
        <Modal title="Regeln: Cricket" onClose={() => setShowRules(false)}>
          {cricketRules(s).map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Modal>
      )}
    </div>
  );
}
