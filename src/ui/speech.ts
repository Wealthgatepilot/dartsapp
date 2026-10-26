// Sprachausgabe über die Stimme des Geräts (SPEC 10, Web Speech API). An/aus wird je Gerät gemerkt
// (Browser-Speicher, reine Bequemlichkeit); Standard ist an.

import { useEffect, useState } from 'preact/hooks';

const KEY = 'speech.enabled';
const listeners = new Set<(on: boolean) => void>();

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function speechEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSpeechEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // ohne Browser-Speicher gilt die Einstellung nur bis zum Neuladen
  }
  if (!on && speechSupported()) speechSynthesis.cancel();
  for (const l of listeners) l(on);
}

/** An/aus als Zustand für Knöpfe; alle Anzeigen bleiben gleich, egal wo umgeschaltet wird. */
export function useSpeechEnabled(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(speechEnabled);
  useEffect(() => {
    listeners.add(setOn);
    return () => void listeners.delete(setOn);
  }, []);
  return [on, setSpeechEnabled];
}

/** Deutsche Stimme, wenn das Gerät eine hat. */
function germanVoice(): SpeechSynthesisVoice | undefined {
  return speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('de'));
}

/** Text vorlesen (eine laufende Ansage wird abgebrochen). */
export function speak(text: string | null): void {
  if (!text || !speechSupported() || !speechEnabled()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  const voice = germanVoice();
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

/**
 * Auf dem iPhone spricht der Browser erst, nachdem einmal aus einer Berührung heraus gesprochen wurde
 * (SPEC 10). Deshalb beim Tippen auf „Spiel starten“ eine stumme Ansage.
 */
export function unlockSpeech(): void {
  if (!speechSupported() || !speechEnabled()) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}
