// Kleine, wiederverwendbare Bausteine der Oberfläche.

import type { ComponentChildren } from 'preact';

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div class="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          class={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div class="stepper" aria-label={label}>
      <button type="button" disabled={value - step < min} onClick={() => onChange(value - step)} aria-label={`${label} weniger`}>
        −
      </button>
      <span>{value}</span>
      <button type="button" disabled={value + step > max} onClick={() => onChange(value + step)} aria-label={`${label} mehr`}>
        +
      </button>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  wide?: boolean;
}) {
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class={wide ? 'modal modal-wide' : 'modal'} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header class="modal-head">
          <h2>{title}</h2>
          <button type="button" class="btn-icon" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>
        <div class="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function TopBar({ title, back, right }: { title: string; back?: string; right?: ComponentChildren }) {
  return (
    <header class="topbar">
      {back ? (
        <a class="btn-icon" href={back} aria-label="Zurück">
          ‹
        </a>
      ) : (
        <span class="btn-icon-space" />
      )}
      <h1>{title}</h1>
      <div class="topbar-right">{right ?? <span class="btn-icon-space" />}</div>
    </header>
  );
}

export const PROFILE_COLORS = ['#e8590c', '#f0b429', '#2f9e44', '#1c7ed6', '#7048e8', '#d6336c', '#0ca678', '#868e96'];
