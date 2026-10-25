// Prototyp für Haltepunkt 1: nur das Board, ohne Spiel und ohne Speicher.
// Zeigt an, was getippt wurde, damit Gianluca die Eingabe am Handy beurteilen kann.

import { useState } from 'preact/hooks';
import { MISS, fieldLabel, points, type Field } from '../engine/types';
import { Board, type Preview } from './board/Board';

export function BoardTest() {
  const [darts, setDarts] = useState<Field[]>([]);
  const [preview, setPreview] = useState<Preview>(null);

  const add = (f: Field) => setDarts((d) => [...d, f].slice(-30));
  const removeAt = (i: number) => setDarts((d) => d.filter((_, j) => j !== i));
  const lastThree = darts.slice(-3);
  const offset = darts.length - lastThree.length;

  return (
    <div class="screen">
      <section class="panel">
        <header class="panel-head">
          <h1>Board-Test</h1>
          <span class="muted">Prototyp · Phase 1</span>
        </header>

        <div class={preview ? 'preview preview-on' : 'preview'} aria-live="polite">
          {preview === null && <span class="muted">Segment antippen, für D/T zur Leiste ziehen</span>}
          {preview && 'cancel' in preview && <span>Abbrechen</span>}
          {preview && 'field' in preview && (
            <span>
              {fieldLabel(preview.field)} = {points(preview.field)}
            </span>
          )}
        </div>

        <div class="pills">
          {lastThree.map((f, i) => (
            <button key={offset + i} class={`pill m${f.m}`} onClick={() => removeAt(offset + i)} aria-label="Dart entfernen">
              {fieldLabel(f)} · {points(f)} <span class="pill-x">×</span>
            </button>
          ))}
          {lastThree.length === 0 && <span class="muted">Noch keine Darts</span>}
        </div>
        <div class="sum">
          Letzte 3: <strong>{lastThree.reduce((s, f) => s + points(f), 0)}</strong>
        </div>

        <div class="actions">
          <button class="btn" onClick={() => setDarts((d) => d.slice(0, -1))} disabled={darts.length === 0}>
            ↶ Rückgängig
          </button>
          <button class="btn btn-big" onClick={() => add(MISS)}>
            Daneben
          </button>
        </div>

        <details class="history">
          <summary>Alle Eingaben ({darts.length})</summary>
          <p>{darts.map(fieldLabel).join(', ') || '—'}</p>
        </details>
      </section>

      <section class="board-wrap">
        <Board onDart={add} onPreview={setPreview} />
      </section>
    </div>
  );
}
