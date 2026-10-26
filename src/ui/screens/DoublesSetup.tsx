// Setup Doppelfeld-Training (SPEC 7.4): Spieler, Zielfolge, Modus, Regeln.

import { useState } from 'preact/hooks';
import { DEFAULT_DOUBLES, validateDoubles, type DoublesSettings } from '../../engine/doubles';
import { doublesRules, doublesVariants } from '../../engine/rules';
import { RulesModal, Segmented, Stepper, TopBar } from '../components';
import { href } from '../router';
import { PlayerPicker, StartMethodSetting, useSavedSetup, useStartGame, type Pick } from '../setup';
import type { StartMethod } from '../../engine/events';
import { StartButton } from './X01Setup';

const ALL = DEFAULT_DOUBLES.targets!;

interface SavedSetup {
  settings: DoublesSettings;
  picks: Pick[];
  start?: StartMethod;
}

export function DoublesSetup() {
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastDoublesSetup', { settings: DEFAULT_DOUBLES, picks: [] });
  const start = useStartGame();
  const [showRules, setShowRules] = useState(false);
  const s = setup.settings;
  const set = (patch: Partial<DoublesSettings>) => setSetup((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const errors = validateDoubles(s);
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');
  const fixedDarts = s.mode.kind === 'fixed' ? s.mode.darts : 9;
  // Ältere gespeicherte Einstellungen ohne Zielauswahl: alle 21
  const targets = s.targets ?? ALL;
  const toggle = (n: number) =>
    set({ targets: ALL.filter((x) => (x === n ? !targets.includes(n) : targets.includes(x))) });

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    await start(setup.picks, { mode: 'doubles', settings: s }, setup.start);
  };

  return (
    <div class="page">
      <TopBar
        title="Doppelfeld-Training"
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
          <span>Zielfolge</span>
          <Segmented
            value={s.sequence}
            options={[
              { value: 'own', label: 'jeder eigene' },
              { value: 'shared', label: 'alle gleich' },
            ]}
            onChange={(sequence) => set({ sequence })}
          />
        </div>
        <div class="setting">
          <span>Ziel wechselt</span>
          <Segmented
            value={s.mode.kind}
            options={[
              { value: 'untilHit', label: 'beim Treffer' },
              { value: 'fixed', label: 'nach festen Darts' },
            ]}
            onChange={(kind) => set({ mode: kind === 'untilHit' ? { kind } : { kind, darts: fixedDarts } })}
          />
        </div>
        <div class="field">
          <span>Ziele</span>
          <div class="chips">
            {ALL.map((n) => (
              <button
                key={n}
                class={targets.includes(n) ? 'chip chip-num on' : 'chip chip-num'}
                onClick={() => toggle(n)}
                aria-pressed={targets.includes(n)}
              >
                {n === 25 ? 'Bull' : `D${n}`}
              </button>
            ))}
          </div>
          <div class="row">
            <button class="btn btn-small" onClick={() => set({ targets: ALL })}>
              Alle 21
            </button>
            <button class="btn btn-small" onClick={() => set({ targets: [] })}>
              Keine
            </button>
          </div>
        </div>
        {s.mode.kind === 'fixed' && (
          <div class="setting">
            <span>Darts pro Feld</span>
            <Stepper
              label="Darts pro Feld"
              value={fixedDarts}
              min={1}
              max={30}
              onChange={(darts) => set({ mode: { kind: 'fixed', darts } })}
            />
          </div>
        )}
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && (
        <RulesModal
          title="Regeln: Doppelfeld-Training"
          rules={doublesRules(s)}
          variants={doublesVariants()}
          onClose={() => setShowRules(false)}
        />
      )}
    </div>
  );
}
