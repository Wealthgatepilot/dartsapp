// Daten sichern und laden (SPEC 13.3, 13.4).

import { useRef, useState } from 'preact/hooks';
import { parseBackup, previewImport, type BackupFile, type ImportPreview } from '../../data/backup';
import { daysSince, exportBackup } from '../backup';
import { Modal } from '../components';
import { useAppData } from '../data';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function lastBackupText(ts: number | undefined): string {
  const d = daysSince(ts);
  if (d === null) return 'noch nie';
  if (d === 0) return 'heute';
  if (d === 1) return 'gestern';
  return `vor ${d} Tagen`;
}

export function BackupCard() {
  const { store, events, lastBackupAt, reload } = useAppData();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; preview: ImportPreview } | null>(null);

  const save = async () => {
    const r = await exportBackup(store);
    await reload();
    setMessage(r === 'cancelled' ? 'Sicherung abgebrochen.' : 'Sicherung erstellt.');
  };

  const load = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // dieselbe Datei darf erneut gewählt werden
    if (!file) return;
    const parsed = await parseBackup(await file.text());
    if (!parsed.ok) return setMessage(`Nichts geändert. ${parsed.error}`);
    setMessage(null);
    setPending({ backup: parsed.backup, preview: previewImport(new Set(events.map((x) => x.id)), parsed.backup) });
  };

  return (
    <section class="card">
      <h2>Daten sichern</h2>
      <p>
        <strong>Letzte Sicherung:</strong> {lastBackupText(lastBackupAt)}
      </p>
      <p class="muted small">
        Die Sicherung ist eine Datei mit allen Darts, Spielen und Profilen. Leg sie in „Dateien“ oder iCloud ab. Wird die
        App gelöscht, sind die Daten auf dem Handy weg – nur die Sicherung bleibt.
      </p>
      <div class="row">
        <button class="btn btn-primary" onClick={save}>
          Sicherung erstellen
        </button>
        <button class="btn" onClick={() => fileInput.current?.click()}>
          Sicherung laden
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={load} />
      </div>
      {message && <p class="small">{message}</p>}
      {pending && (
        <ImportDialog
          backup={pending.backup}
          preview={pending.preview}
          onClose={() => setPending(null)}
          onDone={(added) => {
            setPending(null);
            setMessage(`${count(added, 'Ereignis', 'Ereignisse')} importiert.`);
          }}
        />
      )}
    </section>
  );
}

function ImportDialog({
  backup,
  preview,
  onClose,
  onDone,
}: {
  backup: BackupFile;
  preview: ImportPreview;
  onClose: () => void;
  onDone: (added: number) => void;
}) {
  const { store, events, reload } = useAppData();
  // Vor jedem Import zuerst den aktuellen Stand sichern (SPEC 13.4). Bei leerem Speicher nicht nötig.
  const [saved, setSaved] = useState(events.length === 0);
  const [busy, setBusy] = useState(false);
  const date = new Date(backup.exportedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

  const saveFirst = async () => {
    const r = await exportBackup(store);
    await reload();
    if (r !== 'cancelled') setSaved(true);
  };

  const run = async () => {
    setBusy(true);
    try {
      const added = await store.importEvents(preview.newEvents);
      await reload();
      onDone(added);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Sicherung laden" onClose={onClose}>
      <p>
        Sicherung vom {date} · Gerät {backup.deviceId.slice(0, 8)}
      </p>
      {preview.newEvents.length === 0 ? (
        <>
          <p>Alles aus dieser Sicherung ist schon vorhanden. Es gibt nichts zu importieren.</p>
          <button class="btn" onClick={onClose}>
            Schließen
          </button>
        </>
      ) : (
        <>
          <p>
            <strong>{count(preview.newEvents.length, 'neues Ereignis', 'neue Ereignisse')}</strong> (
            {count(preview.newProfiles, 'neues Profil', 'neue Profile')}, {count(preview.newGames, 'neues Spiel', 'neue Spiele')}
            ), {preview.alreadyPresent} schon vorhanden.
          </p>
          <p class="muted small">
            Es wird nur hinzugefügt. Nichts auf diesem Gerät wird überschrieben oder gelöscht.
          </p>
          <button class={saved ? 'btn' : 'btn btn-primary'} disabled={saved} onClick={saveFirst}>
            {saved ? '✓ Aktueller Stand gesichert' : '1. Aktuellen Stand sichern'}
          </button>
          <button class="btn btn-primary" disabled={!saved || busy} onClick={run}>
            {events.length === 0 ? 'Importieren' : '2. Importieren'}
          </button>
        </>
      )}
    </Modal>
  );
}
