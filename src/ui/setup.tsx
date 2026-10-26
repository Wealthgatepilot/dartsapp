// Gemeinsame Bausteine der Setup-Bildschirme: Spielerauswahl, Legs/Sets, letzte Einstellungen, Spielstart.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Race } from '../engine/core';
import type { GameCreatedPayload, Participant, StartMethod } from '../engine/events';
import { listProfiles, type Profile } from '../engine/profiles';
import { uuidv7 } from '../data/ids';
import { Segmented, Stepper } from './components';
import { useAppData } from './data';
import { href, navigate } from './router';

export type Pick =
  | { kind: 'profile'; profileId: string }
  | { kind: 'guest'; guestName: string }
  /** Computergegner (SPEC 9); botId unterscheidet mehrere Computer gleicher Stufe. */
  | { kind: 'bot'; botLevel: number; botId: string; human?: boolean };

/** Eindeutiger Schlüssel eines ausgewählten Spielers, z. B. für sein Handicap. */
export const pickKey = (p: Pick) =>
  p.kind === 'profile' ? `p:${p.profileId}` : p.kind === 'guest' ? `g:${p.guestName}` : `b:${p.botId}`;

/** Anzeigename eines ausgewählten Spielers. */
export function usePickName(): (p: Pick) => string {
  const profiles = useActiveProfiles();
  return (p) =>
    p.kind === 'guest'
      ? `${p.guestName} (Gast)`
      : p.kind === 'bot'
        ? `Computer ${p.botLevel}${p.human === false ? ' · gleichmäßig' : ''}`
        : (profiles.find((x) => x.profileId === p.profileId)?.name ?? '?');
}

const RACE_KIND: { value: Race['kind']; label: string }[] = [
  { value: 'firstTo', label: 'first to' },
  { value: 'bestOf', label: 'best of' },
];

export function useActiveProfiles(): Profile[] {
  const { events } = useAppData();
  return useMemo(() => listProfiles(events).filter((p) => !p.archived), [events]);
}

/**
 * Letzte Einstellungen eines Setups laden und merken (pro Modus ein Schlüssel).
 * Profile, die es nicht mehr gibt, fallen aus der Auswahl.
 */
export function useSavedSetup<T extends { picks: Pick[] }>(key: string, defaults: T, onLoad?: (saved: T) => void) {
  const { store } = useAppData();
  const profiles = useActiveProfiles();
  const [setup, setSetup] = useState<T>(defaults);
  useEffect(() => {
    store.getMeta<T>(key).then((saved) => {
      if (!saved) return;
      const merged = {
        ...defaults,
        ...saved,
        picks: saved.picks.filter((p) => p.kind !== 'profile' || profiles.some((x) => x.profileId === p.profileId)),
      };
      setSetup(merged);
      onLoad?.(merged);
    });
    // nur beim Öffnen des Bildschirms
  }, []);
  const save = (value: T) => store.setMeta(key, value);
  return [setup, setSetup, save] as const;
}

/** onChange bekommt eine Änderungsfunktion, damit schnelle Tipps hintereinander keine Auswahl verlieren. */
export function PlayerPicker({ picks, onChange }: { picks: Pick[]; onChange: (update: (p: Pick[]) => Pick[]) => void }) {
  const profiles = useActiveProfiles();
  const [guest, setGuest] = useState('');
  const [botLevel, setBotLevel] = useState(5);
  const [botHuman, setBotHuman] = useState(true);

  const toggle = (profileId: string) =>
    onChange((cur) =>
      cur.some((p) => p.kind === 'profile' && p.profileId === profileId)
        ? cur.filter((p) => !(p.kind === 'profile' && p.profileId === profileId))
        : [...cur, { kind: 'profile', profileId }],
    );

  const addGuest = (e: Event) => {
    e.preventDefault();
    const name = guest.trim();
    onChange((cur) => [
      ...cur,
      { kind: 'guest', guestName: (name || `Gast ${cur.filter((p) => p.kind === 'guest').length + 1}`).slice(0, 30) },
    ]);
    setGuest('');
  };

  const move = (i: number, d: -1 | 1) =>
    onChange((cur) => {
      const next = [...cur];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  const pickName = usePickName();

  return (
    <section class="card">
      <h2>Spieler</h2>
      <div class="chips">
        {profiles.map((p) => {
          const on = picks.some((x) => x.kind === 'profile' && x.profileId === p.profileId);
          return (
            <button key={p.profileId} class={on ? 'chip on' : 'chip'} onClick={() => toggle(p.profileId)}>
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
      <div class="row bot-row">
        <span class="grow">Computer, Stufe</span>
        <Stepper label="Stufe" value={botLevel} min={1} max={10} onChange={setBotLevel} />
        <button
          class="btn btn-small"
          onClick={() => onChange((cur) => [...cur, { kind: 'bot', botLevel, botId: uuidv7(), human: botHuman }])}
        >
          + Computer
        </button>
      </div>
      <div class="setting">
        <span>Schwankungen (Form, Streaks, Druck)</span>
        <Segmented
          label="Schwankungen"
          value={botHuman ? 'an' : 'aus'}
          options={[
            { value: 'an', label: 'an' },
            { value: 'aus', label: 'aus' },
          ]}
          onChange={(v) => setBotHuman(v === 'an')}
        />
      </div>
      {picks.length > 0 && (
        <ol class="order">
          {picks.map((p, i) => (
            <li key={i}>
              <span class="grow">{pickName(p)}</span>
              <button class="btn-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="nach oben">
                ↑
              </button>
              <button class="btn-icon" disabled={i === picks.length - 1} onClick={() => move(i, 1)} aria-label="nach unten">
                ↓
              </button>
              <button class="btn-icon" onClick={() => onChange((cur) => cur.filter((_, j) => j !== i))} aria-label="entfernen">
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
      <p class="muted small">Die Reihenfolge ist die Wurfreihenfolge im ersten Leg.</p>
    </section>
  );
}

/** Legs und Sets („first to“ / „best of“). */
export function LegsSets({
  legs,
  sets,
  onChange,
}: {
  legs: Race;
  sets: Race | null;
  onChange: (v: { legs: Race; sets: Race | null }) => void;
}) {
  return (
    <>
      <div class="setting">
        <span>Legs</span>
        <span class="row">
          <Segmented value={legs.kind} options={RACE_KIND} onChange={(kind) => onChange({ legs: { ...legs, kind }, sets })} />
          <Stepper label="Legs" value={legs.count} min={1} max={99} onChange={(count) => onChange({ legs: { ...legs, count }, sets })} />
        </span>
      </div>
      <div class="setting">
        <span>Sets</span>
        <span class="row">
          {sets ? (
            <>
              <Segmented value={sets.kind} options={RACE_KIND} onChange={(kind) => onChange({ legs, sets: { ...sets, kind } })} />
              <Stepper
                label="Sets"
                value={sets.count}
                min={0}
                max={99}
                onChange={(count) => onChange({ legs, sets: count === 0 ? null : { ...sets, count } })}
              />
            </>
          ) : (
            <button class="btn btn-small" onClick={() => onChange({ legs, sets: { count: 3, kind: 'bestOf' } })}>
              Sets an
            </button>
          )}
        </span>
      </div>
    </>
  );
}

type CreatedWithoutIds = GameCreatedPayload extends infer G
  ? G extends GameCreatedPayload
    ? Omit<G, 'gameId' | 'participants' | 'seed'>
    : never
  : never;

/** Wer beginnt (SPEC 6.3). Bei einem Spieler gibt es nichts zu wählen. */
export function StartMethodSetting({
  value,
  players,
  onChange,
}: {
  value: StartMethod;
  players: number;
  onChange: (v: StartMethod) => void;
}) {
  if (players < 2) return null;
  return (
    <div class="setting">
      <span>Wer beginnt</span>
      <Segmented<StartMethod>
        value={value}
        options={[
          { value: 'bull', label: 'Ausbullen' },
          { value: 'coin', label: 'Münzwurf' },
          { value: 'asEntered', label: 'wie eingetragen' },
        ]}
        onChange={onChange}
      />
    </div>
  );
}

/**
 * Legt das Spiel an und öffnet es. Bei „wie eingetragen“ (oder nur einem Spieler) steht die Reihenfolge sofort fest,
 * sonst legt der Ausbullen- bzw. Münzwurf-Bildschirm sie fest (game.orderDecided).
 */
export function useStartGame() {
  const { append } = useAppData();
  /** startScores: Handicap je Spieler (Schlüssel aus `pickKey`), nur bei X01. */
  return async (picks: Pick[], mode: CreatedWithoutIds, start: StartMethod = 'asEntered', startScores?: Record<string, number>) => {
    const gameId = uuidv7();
    const participants: Participant[] = picks.map((p, slot) => {
      const own = startScores?.[pickKey(p)];
      const who: Omit<Participant, 'slot'> =
        p.kind === 'bot' ? { kind: 'bot', botLevel: p.botLevel, botHuman: p.human !== false } : p;
      return { slot, ...who, ...(own ? { startScore: own } : {}) };
    });
    const method: StartMethod = picks.length < 2 ? 'asEntered' : start;
    await append([
      { type: 'game.created', payload: { ...mode, gameId, participants, seed: Date.now(), start: method } as GameCreatedPayload },
      ...(method === 'asEntered'
        ? [
            {
              type: 'game.orderDecided' as const,
              payload: { gameId, order: participants.map((p) => p.slot), method: 'asEntered' as const },
            },
          ]
        : []),
    ]);
    navigate({ name: 'game', gameId }, true);
  };
}
