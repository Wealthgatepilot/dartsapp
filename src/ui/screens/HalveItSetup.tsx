// Halve-It-Setup (SPEC 7.9): Spieler, Zielfolge frei zusammenstellen, Startpunkte, Regeln.

import { useState } from 'preact/hooks';
import type { StartMethod } from '../../engine/events';
import {
  DEFAULT_HALVEIT,
  MAX_HALVEIT_TARGETS,
  halveTargetName,
  validateHalveIt,
  type HalveItSettings,
  type HalveTarget,
} from '../../engine/halveit';
import { halveItRules, halveItVariants } from '../../engine/rules';
import { BULL } from '../../engine/types';
import { RulesModal, Stepper, TopBar } from '../components';
import { href } from '../router';
import { PlayerPicker, StartMethodSetting, useSavedSetup, useStartGame, type Pick } from '../setup';
import { StartButton } from './X01Setup';

interface SavedSetup {
  settings: HalveItSettings;
  picks: Pick[];
  start?: StartMethod;
}

/** Bausteine zum Anhängen an die Zielfolge. */
const PALETTE: HalveTarget[] = [...Array.from({ length: 20 }, (_, i) => i + 1), BULL, 'D', 'T'];

export function HalveItSetup() {
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastHalveItSetup', { settings: DEFAULT_HALVEIT, picks: [] });
  const start = useStartGame();
  const [showRules, setShowRules] = useState(false);
  const s = setup.settings;
  const set = (patch: Partial<HalveItSettings>) => setSetup((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const errors = validateHalveIt(s);
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    await start(setup.picks, { mode: 'halveit', settings: s }, setup.start);
  };

  return (
    <div class="page">
      <TopBar
        title="Halve-It"
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
          <span>Startpunkte</span>
          <Stepper label="Startpunkte" value={s.startPoints} min={0} max={100} step={10} onChange={(startPoints) => set({ startPoints })} />
        </div>
        <div class="field">
          <span>Zielfolge ({s.targets.length}) – antippen entfernt</span>
          <ol class="chips halve-sequence" aria-label="Zielfolge">
            {s.targets.map((t, i) => (
              <li key={`${i}-${t}`}>
                <button
                  class="chip chip-num on"
                  aria-label={`Ziel ${i + 1}: ${halveTargetName(t)} entfernen`}
                  onClick={() => set({ targets: s.targets.filter((_, k) => k !== i) })}
                >
                  {halveTargetName(t)} ×
                </button>
              </li>
            ))}
          </ol>
          <span class="muted small">Ziel anhängen:</span>
          <div class="chips">
            {PALETTE.map((t) => (
              <button
                key={t}
                class="chip chip-num"
                disabled={s.targets.length >= MAX_HALVEIT_TARGETS}
                aria-label={`${halveTargetName(t)} anhängen`}
                onClick={() => set({ targets: [...s.targets, t] })}
              >
                {halveTargetName(t)}
              </button>
            ))}
          </div>
          <div class="row">
            <button class="btn btn-small" onClick={() => set({ targets: DEFAULT_HALVEIT.targets })}>
              Standard
            </button>
            <button class="btn btn-small" onClick={() => set({ targets: [] })}>
              Alle entfernen
            </button>
          </div>
        </div>
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && (
        <RulesModal title="Regeln: Halve-It" rules={halveItRules(s)} variants={halveItVariants()} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
