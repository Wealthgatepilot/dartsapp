// Service Worker anmelden und melden, wenn eine neue Version bereitliegt (SPEC 13.2).
// Die neue Version wird nur auf der Startseite angeboten, also nie mitten im Spiel.

import { createContext, type ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';

interface Pwa {
  needRefresh: boolean;
  offlineReady: boolean;
  dismissOfflineReady: () => void;
  update: () => void;
}

const Ctx = createContext<Pwa>({ needRefresh: false, offlineReady: false, dismissOfflineReady: () => {}, update: () => {} });

export const usePwa = () => useContext(Ctx);

const HOUR = 60 * 60 * 1000;

export function PwaProvider({ children }: { children: ComponentChildren }) {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // Bei langen Abenden am Board stündlich nach einer neuen Version schauen.
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update().catch(() => undefined), HOUR);
    },
  });
  return (
    <Ctx.Provider
      value={{
        needRefresh,
        offlineReady,
        dismissOfflineReady: () => setOfflineReady(false),
        update: () => void updateServiceWorker(true),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
