// Killer-Setup (SPEC 7.6): Spieler, Zahlen (zufällig oder selbst gewählt), Leben, Treffer bis Killer,
// Trefferzone, Eigentreffer, Regeln. Die Zahlen werden beim Start festgelegt und mit dem Spiel gespeichert.

import { useState } from 'preact/hooks';
import type { StartMethod } from '../../engine/events';
import {
  DEFAULT_KILLER,
  randomKillerNumbers,
  validateKiller,
  validateKillerNumbers,
  type KillerSettings,
} from '../../engine/killer';
import { killerRules, killerVariants } from '../../engine/rules';
import { RulesModal, Segmented, Stepper, TopBar } from '../components';
import { href } from '../router';
import { PlayerPicker, StartMethodSetting, pickKey, usePickName, useSavedSetup, useStartGame, type Pick } from '../setup';
import { StartButton } from './X01Setup';

interface SavedSetup {
  settings: KillerSettings;
  picks: Pick[];
  start?: StartMethod;
  /** Selbst gewählte Zahlen je Spieler (Schlüssel aus `pickKey`). */
  chosen?: Record<string, number>;
}

/** Zufall wie beim Münzwurf aus `crypto.getRandomValues` (SPEC 6.3). */
export function cryptoRandom(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

export function KillerSetup() {
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastKillerSetup', { settings: DEFAULT_KILLER, picks: [] });
  const start = useStartGame();
  const pickName = usePickName();
  const [showRules, setShowRules] = useState(false);
  const s = setup.settings;
  const set = (patch: Partial<KillerSettings>) => setSetup((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const chosen = (p: Pick) => setup.chosen?.[pickKey(p)] ?? 0;

  const errors = validateKiller(s, setup.picks.length);
  if (s.assignment === 'choose' && setup.picks.length > 0) errors.push(...validateKillerNumbers(setup.picks.map(chosen)));

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    const list = s.assignment === 'random' ? randomKillerNumbers(setup.picks.length, cryptoRandom) : setup.picks.map(chosen);
    const numbers = Object.fromEntries(list.map((n, slot) => [slot, n]));
    await start(setup.picks, { mode: 'killer', settings: { ...s, numbers } }, setup.start);
  };

  return (
    <div class="page">
      <TopBar
        title="Killer"
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
          <span>Zahlen</span>
          <Segmented<KillerSettings['assignment']>
            value={s.assignment}
            options={[
              { value: 'random', label: 'zufällig' },
              { value: 'choose', label: 'selbst wählen' },
            ]}
            onChange={(assignment) => set({ assignment })}
          />
        </div>
        {s.assignment === 'choose' &&
          setup.picks.map((p) => (
            <label key={pickKey(p)} class="setting">
              <span>Zahl {pickName(p)}</span>
              <select
                class="select"
                aria-label={`Zahl ${pickName(p)}`}
                value={chosen(p)}
                onChange={(e) => {
                  const v = Number((e.target as HTMLSelectElement).value);
                  setSetup((x) => ({ ...x, chosen: { ...x.chosen, [pickKey(p)]: v } }));
                }}
              >
                <option value={0}>–</option>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
        <div class="setting">
          <span>Leben</span>
          <Stepper label="Leben" value={s.lives} min={1} max={9} onChange={(lives) => set({ lives })} />
        </div>
        <div class="setting">
          <span>Treffer bis Killer</span>
          <Stepper label="Treffer bis Killer" value={s.hitsToKiller} min={1} max={3} onChange={(hitsToKiller) => set({ hitsToKiller })} />
        </div>
        <div class="setting">
          <span>Trefferzone</span>
          <Segmented<KillerSettings['zone']>
            value={s.zone}
            options={[
              { value: 'double', label: 'nur Double' },
              { value: 'segment', label: 'ganzes Segment' },
            ]}
            onChange={(zone) => set({ zone })}
          />
        </div>
        <div class="setting">
          <span>Eigentreffer als Killer</span>
          <Segmented<KillerSettings['selfHit']>
            value={s.selfHit}
            options={[
              { value: 'lose', label: 'kostet ein Leben' },
              { value: 'nothing', label: 'zählt nicht' },
            ]}
            onChange={(selfHit) => set({ selfHit })}
          />
        </div>
      </section>

      <StartButton errors={errors} onStart={go} />

      {showRules && (
        <RulesModal title="Regeln: Killer" rules={killerRules(s)} variants={killerVariants()} onClose={() => setShowRules(false)} />
      )}
    </div>
  );
}
