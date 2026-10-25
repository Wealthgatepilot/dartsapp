// Runde bearbeiten (SPEC 5.2): Aufnahme im laufenden Leg wählen, Darts ersetzen, entfernen oder ergänzen.

import { useState } from 'preact/hooks';
import type { GameEvent, NewEvent } from '../../engine/events';
import { turnScore } from '../../engine/stats';
import { fieldLabel, points, type Field } from '../../engine/types';
import { planEdit, type Turn, type X01State } from '../../engine/x01';
import { Board } from '../board/Board';
import { Modal } from '../components';

export function EditRound({
  state,
  gameEvents,
  nameOf,
  onClose,
  onApply,
}: {
  state: X01State;
  gameEvents: GameEvent[];
  nameOf: (slot: number) => string;
  onClose: () => void;
  onApply: (events: NewEvent[]) => void;
}) {
  const leg = state.legs[state.legs.length - 1];
  const [turn, setTurn] = useState<Turn | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const open = (t: Turn) => {
    setTurn(t);
    setFields(t.darts.map((d) => d.field));
    setSelected(null);
  };

  if (!turn) {
    return (
      <Modal title={`Runden bearbeiten · Leg ${leg.leg}`} onClose={onClose}>
        <ul class="list">
          {[...leg.turns].reverse().map((t) => (
            <li key={`${t.slot}-${t.turnIndex}`}>
              <button class="list-row list-button" onClick={() => open(t)}>
                <span>
                  <strong>R{t.turnIndex}</strong> {nameOf(t.slot)}
                </span>
                <span>
                  {t.darts.map((d) => fieldLabel(d.field)).join(' ') || '—'} ={' '}
                  <strong>{t.bust ? 'Bust' : turnScore(t)}</strong>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    );
  }

  const onDart = (f: Field) => {
    if (selected !== null) {
      setFields((x) => x.map((old, i) => (i === selected ? f : old)));
      setSelected(null);
    } else if (fields.length < 3) {
      setFields((x) => [...x, f]);
    }
  };

  const apply = () => {
    const plan = planEdit(state, gameEvents, turn, fields);
    if (plan.error) return alert(plan.error);
    if (plan.events.length === 0) return onClose();
    const lost = plan.discarded.filter((id) => gameEvents.some((e) => e.id === id && e.type === 'dart.thrown')).length;
    if (plan.outcomeChanged || lost) {
      const parts = [];
      if (plan.outcomeChanged) parts.push('Der Ausgang dieser Aufnahme ändert sich.');
      if (lost) parts.push(`Danach geworfene ${lost} Darts werden verworfen.`);
      if (!confirm(`${parts.join(' ')} Übernehmen?`)) return;
    }
    onApply(plan.events);
  };

  return (
    <Modal title={`R${turn.turnIndex} · ${nameOf(turn.slot)}`} onClose={onClose} wide>
      <div class="pills">
        {fields.map((f, i) => (
          <span key={i} class={`pill m${f.m}${selected === i ? ' pill-selected' : ''}`}>
            <button class="pill-main" onClick={() => setSelected(selected === i ? null : i)}>
              {fieldLabel(f)} · {points(f)}
            </button>
            <button
              class="pill-x"
              onClick={() => {
                setFields((x) => x.filter((_, j) => j !== i));
                setSelected(null);
              }}
              aria-label="entfernen"
            >
              ×
            </button>
          </span>
        ))}
        {fields.length === 0 && <span class="muted">Keine Darts</span>}
      </div>
      <p class="muted small">
        {selected !== null
          ? `Dart ${selected + 1} wird ersetzt: Feld auf dem Board wählen.`
          : fields.length < 3
            ? 'Dart antippen zum Ersetzen, oder auf dem Board einen Dart ergänzen.'
            : 'Dart antippen, um ihn zu ersetzen.'}
      </p>
      <div class="board-modal-wrap">
        <Board onDart={onDart} className="board-modal" disabled={selected === null && fields.length >= 3} />
      </div>
      <div class="row">
        <button class="btn" onClick={() => setTurn(null)}>
          ‹ Zurück
        </button>
        <button class="btn btn-primary grow" onClick={apply}>
          Übernehmen
        </button>
      </div>
    </Modal>
  );
}
