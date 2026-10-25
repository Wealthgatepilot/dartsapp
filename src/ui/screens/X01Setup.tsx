// X01-Setup (SPEC 7.1): Spieler, Einstellungen, Regeln, Start.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { AdviceLevel } from '../../engine/checkout';
import type { Participant } from '../../engine/events';
import { listProfiles } from '../../engine/profiles';
import { x01Rules } from '../../engine/rules';
import { validateSettings, type InOut, type Race, type X01Settings } from '../../engine/x01';
import { uuidv7 } from '../../data/ids';
import { Modal, Segmented, Stepper, TopBar } from '../components';
import { useAppData } from '../data';
import { href, navigate } from '../router';

type Pick = { kind: 'profile'; profileId: string } | { kind: 'guest'; guestName: string };

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

const RACE_KIND: { value: Race['kind']; label: string }[] = [
  { value: 'firstTo', label: 'first to' },
  { value: 'bestOf', label: 'best of' },
];

export function X01Setup() {
  const { events, append, store } = useAppData();
  const profiles = useMemo(() => listProfiles(events).filter((p) => !p.archived), [events]);
  const [setup, setSetup] = useState<SavedSetup>(DEFAULT);
  const [guest, setGuest] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [freeStart, setFreeStart] = useState(false);

  // Letzte Einstellungen wiederherstellen (Profile, die es nicht mehr gibt, fallen weg).
  useEffect(() => {
    store.getMeta<SavedSetup>('lastX01Setup').then((saved) => {
      if (!saved) return;
      setSetup({
        ...saved,
        picks: saved.picks.filter((p) => p.kind === 'guest' || profiles.some((x) => x.profileId === p.profileId)),
      });
      setFreeStart(![301, 501, 701].includes(saved.settings.startScore));
    });
    // nur beim Öffnen des Bildschirms
  }, []);

  const s = setup.settings;
  const set = (patch: Partial<X01Settings>) => setSetup((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const errors = validateSettings(s);
  if (setup.picks.length === 0) errors.push('Mindestens einen Spieler wählen.');

  const toggleProfile = (profileId: string) =>
    setSetup((x) => ({
      ...x,
      picks: x.picks.some((p) => p.kind === 'profile' && p.profileId === profileId)
        ? x.picks.filter((p) => !(p.kind === 'profile' && p.profileId === profileId))
        : [...x.picks, { kind: 'profile', profileId }],
    }));

  const addGuest = (e: Event) => {
    e.preventDefault();
    const name = guest.trim() || `Gast ${setup.picks.filter((p) => p.kind === 'guest').length + 1}`;
    setSetup((x) => ({ ...x, picks: [...x.picks, { kind: 'guest', guestName: name.slice(0, 30) }] }));
    setGuest('');
  };

  const move = (i: number, d: -1 | 1) =>
    setSetup((x) => {
      const picks = [...x.picks];
      [picks[i], picks[i + d]] = [picks[i + d], picks[i]];
      return { ...x, picks };
    });

  const remove = (i: number) => setSetup((x) => ({ ...x, picks: x.picks.filter((_, j) => j !== i) }));

  const pickName = (p: Pick) =>
    p.kind === 'guest' ? `${p.guestName} (Gast)` : (profiles.find((x) => x.profileId === p.profileId)?.name ?? '?');

  const start = async () => {
    if (errors.length) return;
    const gameId = uuidv7();
    const participants: Participant[] = setup.picks.map((p, slot) => ({ slot, ...p }));
    await store.setMeta('lastX01Setup', setup);
    await append([
      {
        type: 'game.created',
        payload: { gameId, mode: 'x01', settings: s, advice: setup.advice, participants, seed: Date.now() },
      },
      { type: 'game.orderDecided', payload: { gameId, order: participants.map((p) => p.slot), method: 'asEntered' } },
    ]);
    navigate({ name: 'game', gameId }, true);
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

      <section class="card">
        <h2>Spieler</h2>
        <div class="chips">
          {profiles.map((p) => {
            const on = setup.picks.some((x) => x.kind === 'profile' && x.profileId === p.profileId);
            return (
              <button key={p.profileId} class={on ? 'chip on' : 'chip'} onClick={() => toggleProfile(p.profileId)}>
                <span class="dot" style={{ background: p.color }} /> {p.name}
              </button>
            );
          })}
          {profiles.length === 0 && (
            <a class="muted" href={href({ name: 'profiles' })}>
              Noch keine Profile – hier anlegen
            </a>
          )}
        </div>
        <form class="row" onSubmit={addGuest}>
          <input
            class="grow"
            value={guest}
            maxLength={30}
            placeholder="Gast (ohne Statistik)"
            onInput={(e) => setGuest((e.target as HTMLInputElement).value)}
          />
          <button class="btn btn-small" type="submit">
            + Gast
          </button>
        </form>
        {setup.picks.length > 0 && (
          <ol class="order">
            {setup.picks.map((p, i) => (
              <li key={i}>
                <span class="grow">{pickName(p)}</span>
                <button class="btn-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="nach oben">
                  ↑
                </button>
                <button
                  class="btn-icon"
                  disabled={i === setup.picks.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="nach unten"
                >
                  ↓
                </button>
                <button class="btn-icon" onClick={() => remove(i)} aria-label="entfernen">
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
        <p class="muted small">Die Reihenfolge ist die Wurfreihenfolge im ersten Leg.</p>
      </section>

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
        <div class="setting">
          <span>Legs</span>
          <span class="row">
            <Segmented value={s.legs.kind} options={RACE_KIND} onChange={(kind) => set({ legs: { ...s.legs, kind } })} />
            <Stepper label="Legs" value={s.legs.count} min={1} max={99} onChange={(count) => set({ legs: { ...s.legs, count } })} />
          </span>
        </div>
        <div class="setting">
          <span>Sets</span>
          <span class="row">
            {s.sets ? (
              <>
                <Segmented
                  value={s.sets.kind}
                  options={RACE_KIND}
                  onChange={(kind) => set({ sets: { ...s.sets!, kind } })}
                />
                <Stepper
                  label="Sets"
                  value={s.sets.count}
                  min={0}
                  max={99}
                  onChange={(count) => set({ sets: count === 0 ? null : { ...s.sets!, count } })}
                />
              </>
            ) : (
              <button class="btn btn-small" onClick={() => set({ sets: { count: 3, kind: 'bestOf' } })}>
                Sets an
              </button>
            )}
          </span>
        </div>
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

      {errors.length > 0 && (
        <ul class="errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button class="btn btn-primary btn-wide" disabled={errors.length > 0} onClick={start}>
        Spiel starten
      </button>

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
