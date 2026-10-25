// X01-Setup (SPEC 7.1): Spieler, Einstellungen, Regeln, Start.

import { useState } from 'preact/hooks';
import type { AdviceLevel } from '../../engine/checkout';
import { x01Rules } from '../../engine/rules';
import { validateSettings, type InOut, type X01Settings } from '../../engine/x01';
import { Modal, Segmented, TopBar } from '../components';
import { href } from '../router';
import { LegsSets, PlayerPicker, useSavedSetup, useStartGame, type Pick } from '../setup';

interface SavedSetup {
  settings: X01Settings;
  advice: AdviceLevel;
  picks: Pick[];
}

const DEFAULT: SavedSetup = {
  settings: { startScore: 501, inMode: 'single', outMode: 'double', legs: { count: 1, kind: 'firstTo' }, sets: null },
  advice: 'expert',
  picks: [],
};

const IN_OUT: { value: InOut; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'master', label: 'Master' },
];

export function X01Setup() {
  const [freeStart, setFreeStart] = useState(false);
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastX01Setup', DEFAULT, (saved) =>
    setFreeStart(![301, 501, 701].includes(saved.settings.startScore)),
  );
  const start = useStartGame();
  const [showRules, setShowRules] = useState(false);

  const s = setup.settings;
  const set = (patch: Partial<X01Settings>) => setSetup((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const errors = validateSettings(s);
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    await start(setup.picks, { mode: 'x01', settings: s, advice: setup.advice });
  };

  return (
    <div class="page">
      <TopBar
        title="X01"
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
          <span>Startpunkte</span>
          <Segmented<number | 'frei'>
            value={freeStart ? 'frei' : s.startScore}
            options={[
              { value: 301, label: '301' },
              { value: 501, label: '501' },
              { value: 701, label: '701' },
              { value: 'frei', label: 'frei' },
            ]}
            onChange={(v) => {
              if (v === 'frei') setFreeStart(true);
              else {
                setFreeStart(false);
                set({ startScore: v });
              }
            }}
          />
        </div>
        {freeStart && (
          <label class="setting">
            <span>Eigener Startwert</span>
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={9999}
              value={s.startScore}
              onInput={(e) => set({ startScore: Number((e.target as HTMLInputElement).value) })}
            />
          </label>
        )}
        <div class="setting">
          <span>In</span>
          <Segmented value={s.inMode} options={IN_OUT} onChange={(v) => set({ inMode: v })} />
        </div>
        <div class="setting">
          <span>Out</span>
          <Segmented value={s.outMode} options={IN_OUT} onChange={(v) => set({ outMode: v })} />
        </div>
        <LegsSets legs={s.legs} sets={s.sets} onChange={(v) => set(v)} />
        <div class="setting">
          <span>Checkout-Hilfe</span>
          <Segmented<AdviceLevel>
            value={setup.advice}
            options={[
              { value: 'expert', label: 'Experte' },
              { value: 'novice', label: 'Einsteiger' },
              { value: 'off', label: 'Aus' },
            ]}
            onChange={(advice) => setSetup((x) => ({ ...x, advice }))}
          />
        </div>
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && (
        <Modal title={`Regeln: ${s.startScore}`} onClose={() => setShowRules(false)}>
          {x01Rules(s).map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Modal>
      )}
    </div>
  );
}

export function StartButton({ errors, onStart }: { errors: string[]; onStart: () => void }) {
  return (
    <>
      {errors.length > 0 && (
        <ul class="errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button class="btn btn-primary btn-wide" disabled={errors.length > 0} onClick={onStart}>
        Spiel starten
      </button>
    </>
  );
}
