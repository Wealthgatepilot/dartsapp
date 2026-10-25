// Profile anlegen, umbenennen, archivieren (SPEC 6.1). Löschen gibt es nicht.

import { useMemo, useState } from 'preact/hooks';
import { createProfile, listProfiles, renameProfile, type Profile } from '../../engine/profiles';
import { uuidv7 } from '../../data/ids';
import { PROFILE_COLORS, TopBar } from '../components';
import { useAppData } from '../data';
import { href } from '../router';

export function Profiles() {
  const { events, append } = useAppData();
  const profiles = useMemo(() => listProfiles(events), [events]);
  const active = profiles.filter((p) => !p.archived);
  const archived = profiles.filter((p) => p.archived);

  const [name, setName] = useState('');
  const [color, setColor] = useState(PROFILE_COLORS[active.length % PROFILE_COLORS.length]);
  const [error, setError] = useState<string | null>(null);

  const add = async (e: Event) => {
    e.preventDefault();
    const r = createProfile(profiles, uuidv7(), name, color);
    if ('error' in r) return setError(r.error);
    await append([r]);
    setName('');
    setError(null);
    setColor(PROFILE_COLORS[(active.length + 1) % PROFILE_COLORS.length]);
  };

  return (
    <div class="page">
      <TopBar title="Profile" back={href({ name: 'home' })} />

      <form class="card" onSubmit={add}>
        <label class="field">
          <span>Neues Profil</span>
          <input
            value={name}
            maxLength={30}
            placeholder="Name"
            autoComplete="off"
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
          />
        </label>
        <div class="colors" role="radiogroup" aria-label="Farbe">
          {PROFILE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={`Farbe ${c}`}
              class={c === color ? 'swatch on' : 'swatch'}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        {error && <p class="error">{error}</p>}
        <button class="btn btn-primary" type="submit">
          Anlegen
        </button>
      </form>

      <ul class="list">
        {active.map((p) => (
          <ProfileRow key={p.profileId} profile={p} profiles={profiles} />
        ))}
        {active.length === 0 && <li class="muted">Noch keine Profile.</li>}
      </ul>

      {archived.length > 0 && (
        <details class="card">
          <summary>Archiviert ({archived.length})</summary>
          <ul class="list">
            {archived.map((p) => (
              <li key={p.profileId} class="list-row">
                <span>
                  <span class="dot" style={{ background: p.color }} /> {p.name}
                </span>
                <button
                  class="btn btn-small"
                  onClick={() => append([{ type: 'profile.restored', payload: { profileId: p.profileId } }])}
                >
                  Wiederherstellen
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p class="muted small">
        Archivierte Profile verschwinden aus der Spielerauswahl. Ihre Statistik bleibt erhalten.
      </p>
    </div>
  );
}

function ProfileRow({ profile, profiles }: { profile: Profile; profiles: Profile[] }) {
  const { append } = useAppData();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: Event) => {
    e.preventDefault();
    if (name.trim() === profile.name) return setEditing(false);
    const r = renameProfile(profiles, profile.profileId, name);
    if ('error' in r) return setError(r.error);
    await append([r]);
    setEditing(false);
    setError(null);
  };

  if (editing) {
    return (
      <li class="list-row">
        <form class="row grow" onSubmit={save}>
          <input value={name} maxLength={30} onInput={(e) => setName((e.target as HTMLInputElement).value)} autoFocus />
          <button class="btn btn-small btn-primary" type="submit">
            OK
          </button>
        </form>
        {error && <p class="error">{error}</p>}
      </li>
    );
  }
  return (
    <li class="list-row">
      <span>
        <span class="dot" style={{ background: profile.color }} /> {profile.name}
      </span>
      <span class="row">
        <button class="btn btn-small" onClick={() => setEditing(true)}>
          Umbenennen
        </button>
        <button
          class="btn btn-small"
          onClick={() => {
            if (confirm(`${profile.name} archivieren? Die Statistik bleibt erhalten.`)) {
              append([{ type: 'profile.archived', payload: { profileId: profile.profileId } }]);
            }
          }}
        >
          Archivieren
        </button>
      </span>
    </li>
  );
}
