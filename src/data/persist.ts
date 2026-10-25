// Dauerhaften Speicher beim Browser anfragen (SPEC 13.2).
// Ist er gewährt, darf der Browser die Daten nicht von sich aus räumen.
// Auf dem iPhone entscheidet Safari selbst, bei installierten Apps meist mit Ja.

import type { EventStore } from './store';

export type PersistStatus = 'granted' | 'denied' | 'unsupported';

export async function requestPersistence(store: EventStore, storage = globalThis.navigator?.storage): Promise<PersistStatus> {
  let status: PersistStatus = 'unsupported';
  if (storage?.persist) {
    try {
      // Schon gewährt? Dann nicht erneut fragen.
      const already = storage.persisted ? await storage.persisted() : false;
      status = already || (await storage.persist()) ? 'granted' : 'denied';
    } catch {
      status = 'denied';
    }
  }
  await store.setMeta('persist', { status, checkedAt: Date.now() });
  return status;
}

/** Läuft die App als installierte Home-Bildschirm-App? (In Safari getrennter Speicher, SPEC 13.1.) */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
