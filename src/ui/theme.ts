// Aussehen (SPEC 5.6): Kreidegrau (Standard) oder Dunkel. Wird je Gerät gemerkt
// (Browser-Speicher, reine Bequemlichkeit), wie die Sprachausgabe.

import { useEffect, useState } from 'preact/hooks';

export type Theme = 'kreide' | 'dunkel';

const KEY = 'ui.theme';
/** Farbe der Statusleiste je Farbsatz (= Hintergrund). */
const BAR: Record<Theme, string> = { kreide: '#c4c1b8', dunkel: '#14181c' };
const listeners = new Set<(t: Theme) => void>();

export function currentTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dunkel' ? 'dunkel' : 'kreide';
  } catch {
    return 'kreide';
  }
}

/** Farbsatz auf die Seite legen: Die Farben in styles.css hängen an data-theme. */
export function applyTheme(t: Theme): void {
  if (t === 'dunkel') document.documentElement.dataset.theme = 'dunkel';
  else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[t]);
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // ohne Browser-Speicher gilt die Einstellung nur bis zum Neuladen
  }
  applyTheme(t);
  for (const l of listeners) l(t);
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [t, setT] = useState(currentTheme);
  useEffect(() => {
    listeners.add(setT);
    return () => void listeners.delete(setT);
  }, []);
  return [t, setTheme];
}
