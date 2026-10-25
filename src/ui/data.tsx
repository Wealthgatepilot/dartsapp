// Verbindet die Oberfläche mit dem Ereignisspeicher: lädt beim Start alle Ereignisse
// und hängt neue an. Bildschirme lesen nur die Ereignisliste und rechnen daraus.

import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { NewAppEvent } from '../engine/events';
import { requestPersistence, type PersistStatus } from '../data/persist';
import { EventStore, type StoredEvent } from '../data/store';

export interface AppData {
  store: EventStore;
  events: StoredEvent[];
  append: (events: readonly NewAppEvent[]) => Promise<StoredEvent[]>;
  persist: PersistStatus | null;
  /** Zeitpunkt der letzten Sicherung (ms), undefined = noch nie. */
  lastBackupAt: number | undefined;
  /** Ereignisse und Zusatzdaten neu aus dem Speicher lesen, z. B. nach einem Import. */
  reload: () => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppData fehlt');
  return v;
}

export function DataProvider({ children }: { children: ComponentChildren }) {
  const [store, setStore] = useState<EventStore | null>(null);
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [persist, setPersist] = useState<PersistStatus | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // Schreibvorgänge nacheinander ausführen, damit die Reihenfolge stimmt.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await EventStore.open();
        const all = await s.all();
        const backupAt = await s.getMeta<number>('lastBackupAt');
        if (cancelled) return;
        setStore(s);
        setEvents(all);
        setLastBackupAt(backupAt);
        setPersist(await requestPersistence(s));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const append = useCallback(
    (newEvents: readonly NewAppEvent[]) => {
      if (!store) return Promise.reject(new Error('Speicher nicht bereit'));
      const run = queue.current.then(async () => {
        const stored = await store.append(newEvents);
        setEvents((prev) => [...prev, ...stored]);
        return stored;
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [store],
  );

  const reload = useCallback(async () => {
    if (!store) return;
    await queue.current;
    setEvents(await store.all());
    setLastBackupAt(await store.getMeta<number>('lastBackupAt'));
  }, [store]);

  if (error) {
    return (
      <div class="page">
        <h1>Speicher nicht verfügbar</h1>
        <p>Die App kann auf diesem Gerät nichts speichern. Im privaten Modus des Browsers geht das oft nicht.</p>
        <p class="muted">{error}</p>
      </div>
    );
  }
  if (!store) return <div class="page muted">Lade …</div>;
  return (
    <Ctx.Provider value={{ store, events, append, persist, lastBackupAt, reload }}>{children}</Ctx.Provider>
  );
}
