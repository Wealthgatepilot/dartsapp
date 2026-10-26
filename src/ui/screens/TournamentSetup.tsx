// Turnier anlegen (SPEC 8.2): Teilnehmer, Spielmodus mit Einstellungen, Turnierform, wer beginnt.

import { DEFAULT_ATC, type AtcSettings } from '../../engine/atc';
import type { AdviceLevel } from '../../engine/checkout';
import type { Race } from '../../engine/core';
import { DEFAULT_COUNTUP, MAX_COUNTUP_ROUNDS } from '../../engine/countup';
import { DEFAULT_CRICKET, type CricketSettings } from '../../engine/cricket';
import type { StartMethod } from '../../engine/events';
import { DEFAULT_HALVEIT } from '../../engine/halveit';
import { DEFAULT_SHANGHAI, type ShanghaiSettings } from '../../engine/shanghai';
import {
  ADVANCE_COUNTS,
  GROUP_COUNTS,
  formatError,
  type Entrant,
  type TournamentCreatedPayload,
  type TournamentFormat,
  type TournamentGameSpec,
  type TournamentMode,
} from '../../engine/tournament';
import { validateSettings, type InOut, type X01Settings } from '../../engine/x01';
import { uuidv7 } from '../../data/ids';
import { Segmented, Stepper, TopBar } from '../components';
import { useAppData } from '../data';
import { href, navigate } from '../router';
import { LegsSets, PlayerPicker, StartMethodSetting, useSavedSetup, type Pick } from '../setup';

interface SavedSetup {
  picks: Pick[];
  mode: TournamentMode;
  x01: X01Settings;
  advice: AdviceLevel;
  cricket: CricketSettings;
  shanghai: ShanghaiSettings;
  countupRounds: number;
  atc: AtcSettings;
  format: TournamentFormat['kind'];
  thirdPlace: boolean;
  twice: boolean;
  groups: number;
  advance: number;
  start: StartMethod;
  /** null = Finale wie alle Partien. */
  finalLegs: Race | null;
}

const DEFAULT: SavedSetup = {
  picks: [],
  mode: 'x01',
  x01: { startScore: 501, inMode: 'single', outMode: 'double', legs: { count: 2, kind: 'firstTo' }, sets: null },
  advice: 'expert',
  cricket: { ...DEFAULT_CRICKET, legs: { count: 2, kind: 'firstTo' } },
  shanghai: { ...DEFAULT_SHANGHAI, rounds: 7 },
  countupRounds: DEFAULT_COUNTUP.rounds,
  atc: DEFAULT_ATC,
  format: 'ko',
  thirdPlace: false,
  twice: false,
  groups: 2,
  advance: 2,
  start: 'bull',
  finalLegs: null,
};

const MODES: { value: TournamentMode; label: string }[] = [
  { value: 'x01', label: 'X01' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'shanghai', label: 'Shanghai' },
  { value: 'countup', label: 'Count-Up' },
  { value: 'atc', label: 'Around the Clock' },
  { value: 'halveit', label: 'Halve-It' },
];

const MODE_NAMES: Record<TournamentMode, string> = Object.fromEntries(MODES.map((m) => [m.value, m.label])) as Record<TournamentMode, string>;

const IN_OUT: { value: InOut; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'master', label: 'Master' },
];

const RACE_KIND: { value: Race['kind']; label: string }[] = [
  { value: 'firstTo', label: 'first to' },
  { value: 'bestOf', label: 'best of' },
];

function specOf(s: SavedSetup): TournamentGameSpec {
  switch (s.mode) {
    case 'x01':
      return { mode: 'x01', settings: s.x01, advice: s.advice };
    case 'cricket':
      return { mode: 'cricket', settings: s.cricket };
    case 'shanghai':
      return { mode: 'shanghai', settings: s.shanghai };
    case 'countup':
      return { mode: 'countup', settings: { rounds: s.countupRounds } };
    case 'atc':
      return { mode: 'atc', settings: s.atc };
    case 'halveit':
      return { mode: 'halveit', settings: DEFAULT_HALVEIT };
  }
}

function formatOf(s: SavedSetup): TournamentFormat {
  if (s.format === 'ko') return { kind: 'ko', thirdPlace: s.thirdPlace };
  if (s.format === 'league') return { kind: 'league', twice: s.twice };
  return { kind: 'groups', groups: s.groups, advance: s.advance, thirdPlace: s.thirdPlace };
}

function entrantOf(p: Pick, i: number): Entrant {
  const id = `e${i + 1}`;
  if (p.kind === 'profile') return { id, kind: 'profile', profileId: p.profileId };
  if (p.kind === 'guest') return { id, kind: 'guest', guestName: p.guestName };
  return { id, kind: 'bot', botLevel: p.botLevel, botHuman: p.human !== false };
}

export function TournamentSetup() {
  const { append } = useAppData();
  const [setup, setSetup, save] = useSavedSetup<SavedSetup>('lastTournamentSetup', DEFAULT);
  const set = (patch: Partial<SavedSetup>) => setSetup((x) => ({ ...x, ...patch }));
  const withLegs = setup.mode === 'x01' || setup.mode === 'cricket';
  const format = formatOf(setup);

  const errors: string[] = [];
  const fe = formatError(format, setup.picks.length);
  if (fe) errors.push(fe);
  if (setup.mode === 'x01') errors.push(...validateSettings(setup.x01));

  const go = async () => {
    if (errors.length) return;
    await save(setup);
    const tournamentId = uuidv7();
    const date = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
    const payload = {
      tournamentId,
      name: `${MODE_NAMES[setup.mode]} · ${date}`,
      start: setup.start,
      format,
      entrants: setup.picks.map(entrantOf),
      seed: Date.now(),
      ...(withLegs && setup.finalLegs ? { finalLegs: setup.finalLegs } : {}),
      ...specOf(setup),
    } as TournamentCreatedPayload;
    await append([{ type: 'tournament.created', payload }]);
    navigate({ name: 'tournament', tournamentId }, true);
  };

  const legs = setup.mode === 'x01' ? setup.x01.legs : setup.cricket.legs;

  return (
    <div class="page">
      <TopBar title="Turnier anlegen" back={href({ name: 'tournaments' })} />

      <PlayerPicker
        title="Teilnehmer"
        hint="Die Paarungen werden ausgelost. Mindestens 2, höchstens 32 Teilnehmer."
        picks={setup.picks}
        onChange={(update) => setSetup((x) => ({ ...x, picks: update(x.picks) }))}
      />

      <section class="card">
        <h2>Spielmodus</h2>
        <Segmented label="Spielmodus" className="segmented-wrap" value={setup.mode} options={MODES} onChange={(mode) => set({ mode })} />
        {setup.mode === 'x01' && (
          <>
            <div class="setting">
              <span>Startpunkte</span>
              <Segmented
                label="Startpunkte"
                value={setup.x01.startScore}
                options={[301, 501, 701].map((v) => ({ value: v, label: String(v) }))}
                onChange={(startScore) => set({ x01: { ...setup.x01, startScore } })}
              />
            </div>
            <div class="setting">
              <span>In</span>
              <Segmented label="In" value={setup.x01.inMode} options={IN_OUT} onChange={(inMode) => set({ x01: { ...setup.x01, inMode } })} />
            </div>
            <div class="setting">
              <span>Out</span>
              <Segmented label="Out" value={setup.x01.outMode} options={IN_OUT} onChange={(outMode) => set({ x01: { ...setup.x01, outMode } })} />
            </div>
            <LegsSets legs={setup.x01.legs} sets={setup.x01.sets} onChange={(v) => set({ x01: { ...setup.x01, ...v } })} />
            <div class="setting">
              <span>Checkout-Hilfe</span>
              <Segmented<AdviceLevel>
                label="Checkout-Hilfe"
                value={setup.advice}
                options={[
                  { value: 'expert', label: 'Experte' },
                  { value: 'novice', label: 'Einsteiger' },
                  { value: 'off', label: 'Aus' },
                ]}
                onChange={(advice) => set({ advice })}
              />
            </div>
          </>
        )}
        {setup.mode === 'cricket' && (
          <>
            <div class="setting">
              <span>Variante</span>
              <Segmented
                label="Variante"
                value={setup.cricket.variant}
                options={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'cutthroat', label: 'Cut-Throat' },
                ]}
                onChange={(variant) => set({ cricket: { ...setup.cricket, variant } })}
              />
            </div>
            <LegsSets legs={setup.cricket.legs} sets={setup.cricket.sets} onChange={(v) => set({ cricket: { ...setup.cricket, ...v } })} />
          </>
        )}
        {setup.mode === 'shanghai' && (
          <>
            <div class="setting">
              <span>Runden (ab der 1)</span>
              <Stepper
                label="Runden"
                value={setup.shanghai.rounds}
                min={1}
                max={21}
                onChange={(rounds) => set({ shanghai: { ...setup.shanghai, startNumber: 1, rounds } })}
              />
            </div>
            <div class="setting">
              <span>Shanghai gewinnt sofort</span>
              <Segmented
                label="Shanghai gewinnt sofort"
                value={setup.shanghai.endOnShanghai ? 'an' : 'aus'}
                options={[
                  { value: 'an', label: 'an' },
                  { value: 'aus', label: 'aus' },
                ]}
                onChange={(v) => set({ shanghai: { ...setup.shanghai, endOnShanghai: v === 'an' } })}
              />
            </div>
          </>
        )}
        {setup.mode === 'countup' && (
          <div class="setting">
            <span>Runden</span>
            <Stepper label="Runden" value={setup.countupRounds} min={1} max={MAX_COUNTUP_ROUNDS} onChange={(countupRounds) => set({ countupRounds })} />
          </div>
        )}
        {setup.mode === 'atc' && (
          <>
            <div class="setting">
              <span>Bull am Ende</span>
              <Segmented
                label="Bull am Ende"
                value={setup.atc.withBull ? 'an' : 'aus'}
                options={[
                  { value: 'an', label: 'an' },
                  { value: 'aus', label: 'aus' },
                ]}
                onChange={(v) => set({ atc: { ...setup.atc, withBull: v === 'an' } })}
              />
            </div>
            <div class="setting">
              <span>Ring</span>
              <Segmented<AtcSettings['ring']>
                label="Ring"
                value={setup.atc.ring}
                options={[
                  { value: 'any', label: 'beliebig' },
                  { value: 'double', label: 'Double' },
                  { value: 'triple', label: 'Triple' },
                ]}
                onChange={(ring) => set({ atc: { ...setup.atc, ring, jumps: ring === 'any' ? setup.atc.jumps : false } })}
              />
            </div>
          </>
        )}
        {setup.mode === 'halveit' && <p class="muted small">Zielfolge: 15, 16, Double, 17, 18, Triple, 19, 20, Bull.</p>}
        {!withLegs && <p class="muted small">Eine Partie ist ein Spiel. Bei Gleichstand wird ausgebullt.</p>}
      </section>

      <section class="card">
        <h2>Turnier</h2>
        <Segmented<TournamentFormat['kind']>
          label="Turnierform"
          className="segmented-wrap"
          value={setup.format}
          options={[
            { value: 'ko', label: 'K.-o.' },
            { value: 'league', label: 'Jeder gegen jeden' },
            { value: 'groups', label: 'Gruppen + K.-o.' },
          ]}
          onChange={(f) => set({ format: f })}
        />
        {setup.format === 'league' && (
          <div class="setting">
            <span>Jede Paarung</span>
            <Segmented
              label="Jede Paarung"
              value={setup.twice ? 2 : 1}
              options={[
                { value: 1, label: 'einmal' },
                { value: 2, label: 'zweimal' },
              ]}
              onChange={(v) => set({ twice: v === 2 })}
            />
          </div>
        )}
        {setup.format === 'groups' && (
          <>
            <div class="setting">
              <span>Gruppen</span>
              <Segmented label="Gruppen" value={setup.groups} options={GROUP_COUNTS.map((v) => ({ value: v, label: String(v) }))} onChange={(groups) => set({ groups })} />
            </div>
            <div class="setting">
              <span>Weiter je Gruppe</span>
              <Segmented
                label="Weiter je Gruppe"
                value={setup.advance}
                options={ADVANCE_COUNTS.map((v) => ({ value: v, label: String(v) }))}
                onChange={(advance) => set({ advance })}
              />
            </div>
          </>
        )}
        {setup.format !== 'league' && (
          <div class="setting">
            <span>Spiel um Platz 3</span>
            <Segmented
              label="Spiel um Platz 3"
              value={setup.thirdPlace ? 'an' : 'aus'}
              options={[
                { value: 'an', label: 'an' },
                { value: 'aus', label: 'aus' },
              ]}
              onChange={(v) => set({ thirdPlace: v === 'an' })}
            />
          </div>
        )}
        {withLegs && setup.format !== 'league' && (
          <div class="setting">
            <span>Finale</span>
            <span class="row">
              {setup.finalLegs ? (
                <>
                  <Segmented
                    label="Finale"
                    value={setup.finalLegs.kind}
                    options={RACE_KIND}
                    onChange={(kind) => set({ finalLegs: { ...setup.finalLegs!, kind } })}
                  />
                  <Stepper
                    label="Legs im Finale"
                    value={setup.finalLegs.count}
                    min={0}
                    max={99}
                    onChange={(count) => set({ finalLegs: count === 0 ? null : { ...setup.finalLegs!, count } })}
                  />
                </>
              ) : (
                <button class="btn btn-small" onClick={() => set({ finalLegs: { ...legs, count: legs.count + 1 } })}>
                  wie alle · ändern
                </button>
              )}
            </span>
          </div>
        )}
        <StartMethodSetting value={setup.start} players={2} onChange={(start) => set({ start })} />
      </section>

      {errors.length > 0 && (
        <ul class="errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button class="btn btn-primary btn-wide" disabled={errors.length > 0} onClick={go}>
        Turnier starten
      </button>
    </div>
  );
}
