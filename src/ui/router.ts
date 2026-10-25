// Einfache Navigation über den Teil der Adresse nach „#“.
// So funktioniert die Zurück-Taste von Android und dem Browser.

import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'home' }
  | { name: 'profiles' }
  | { name: 'setup' }
  | { name: 'cricket' }
  | { name: 'game'; gameId: string }
  | { name: 'settings' }
  | { name: 'boardtest' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  switch (parts[0]) {
    case 'profile':
      return { name: 'profiles' };
    case 'x01':
      return { name: 'setup' };
    case 'cricket':
      return { name: 'cricket' };
    case 'spiel':
      return parts[1] ? { name: 'game', gameId: decodeURIComponent(parts[1]) } : { name: 'home' };
    case 'einstellungen':
      return { name: 'settings' };
    case 'board-test':
      return { name: 'boardtest' };
    default:
      return { name: 'home' };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'profiles':
      return '#/profile';
    case 'setup':
      return '#/x01';
    case 'cricket':
      return '#/cricket';
    case 'game':
      return `#/spiel/${encodeURIComponent(r.gameId)}`;
    case 'settings':
      return '#/einstellungen';
    case 'boardtest':
      return '#/board-test';
  }
}

export function navigate(r: Route, replace = false): void {
  if (replace) location.replace(href(r));
  else location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
