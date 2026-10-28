// Spielerblöcke (SPEC 5.3, Wunsch Gianluca): je Spieler Kreis mit Anfangsbuchstabe, Name, dunkles Kästchen,
// großer Stand und Kennzahl-Zeilen. Wer dran ist, bekommt nur einen Rand in seiner Spielerfarbe.
// Gibt es eine zweite Kennzahl-Seite, wechseln Wischen oder Antippen alle Blöcke gemeinsam.

import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';

export interface Block {
  slot: number;
  name: string;
  color: string;
  /** Großer Stand, z. B. Rest 121 oder Ziel D16. */
  big: string;
  /** Inhalt des dunklen Kästchens, z. B. gewonnene Legs. */
  badge?: string;
  badgeLabel?: string;
  /** Kennzahl-Seiten: je Seite Zeilen aus Bezeichnung und Wert. */
  pages: { label: string; value: string }[][];
  /** Zusatzzeile unter dem Stand, z. B. „noch nicht drin“. */
  note?: ComponentChildren;
  dim?: boolean;
}

/** Helle Spielerfarben bekommen dunkle Schrift im Kreis, dunkle weiße. */
function initialColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#212529' : '#fff';
}

export function PlayerBlocks({ blocks, activeSlot }: { blocks: Block[]; activeSlot: number }) {
  const [page, setPage] = useState(0);
  const start = useRef<number | null>(null);
  const swiped = useRef(false);
  const pageCount = Math.max(...blocks.map((b) => b.pages.length));
  const turnPage = (dir: number) => setPage((p) => (p + dir + pageCount) % pageCount);
  const cls = blocks.length === 1 ? 'blocks blocks-1' : blocks.length > 2 ? 'blocks blocks-many' : 'blocks';
  return (
    <div
      class={cls}
      onPointerDown={(e) => {
        start.current = e.clientX;
        swiped.current = false;
      }}
      onPointerUp={(e) => {
        if (start.current === null || pageCount < 2) return;
        const dx = e.clientX - start.current;
        start.current = null;
        if (Math.abs(dx) > 30) {
          swiped.current = true;
          turnPage(dx < 0 ? 1 : -1);
        }
      }}
    >
      {blocks.map((b) => {
        const active = b.slot === activeSlot;
        const rows = b.pages[Math.min(page, b.pages.length - 1)] ?? [];
        return (
          <div
            key={b.slot}
            class={`block${active ? ' active' : ''}${b.dim ? ' block-dim' : ''}`}
            style={{ borderColor: active ? b.color : undefined }}
            data-slot={b.slot}
          >
            <div class="block-head">
              <span class="block-initial" style={{ background: b.color, color: initialColor(b.color) }}>
                {b.name.charAt(0).toUpperCase()}
              </span>
              <span class="block-name">{b.name}</span>
              {b.badge !== undefined && (
                <span class="block-badge" title={b.badgeLabel} aria-label={b.badgeLabel ? `${b.badgeLabel} ${b.badge}` : undefined}>
                  {b.badge}
                </span>
              )}
            </div>
            <div class="block-big">
              <span>{b.big}</span>
            </div>
            {b.note && <div class="block-note">{b.note}</div>}
            <button
              type="button"
              class="block-stats"
              onClick={() => {
                // Nach einem Wisch kommt noch ein Klick hinterher; der darf nicht ein zweites Mal blättern.
                if (swiped.current) swiped.current = false;
                else if (pageCount > 1) turnPage(1);
              }}
              aria-label={pageCount > 1 ? 'Weitere Kennzahlen' : undefined}
              tabIndex={pageCount > 1 ? 0 : -1}
            >
              {rows.map((r) => (
                <span key={r.label} class="block-stat">
                  <span>{r.label}</span>
                  <strong>{r.value}</strong>
                </span>
              ))}
            </button>
            {pageCount > 1 && (
              <div class="block-dots" aria-hidden="true">
                {Array.from({ length: pageCount }, (_, i) => (
                  <span key={i} class={i === page ? 'on' : ''} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
