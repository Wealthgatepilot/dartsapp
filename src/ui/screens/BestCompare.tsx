// Bestleistungs-Vergleich im laufenden Spiel (SPEC 12): Endwerte und Stand nach gleich vielen Darts,
// jeweils mit Abweichung in Prozent zum eigenen Rekord in derselben Vergleichsgruppe.

import { useMemo, useState } from 'preact/hooks';
import type { Participant } from '../../engine/events';
import { compareWithBest, type Comparison } from '../../engine/records';
import { Modal } from '../components';
import { useAppData } from '../data';
import { fmtMetric } from './Stats';

const date = (ts: number) => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Abweichung mit Vorzeichen; grün = besser als Rekord, rot = schlechter (je nach Richtung der Kennzahl). */
function Dev({ value, better }: { value: number | null | undefined; better: 'higher' | 'lower' }) {
  if (value === null || value === undefined) return <span class="muted">—</span>;
  const good = better === 'higher' ? value > 0 : value < 0;
  const same = Math.abs(value) < 0.05;
  const text = `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
  return <span class={same ? 'dev' : good ? 'dev dev-good' : 'dev dev-bad'}>{same ? '± 0,0 %' : `${good ? '▲' : '▼'} ${text}`}</span>;
}

export function BestCompare({
  gameId,
  leg,
  participants,
  activeSlot,
  nameOf,
  onClose,
}: {
  gameId: string;
  leg: number;
  participants: Participant[];
  activeSlot: number;
  nameOf: (slot: number) => string;
  onClose: () => void;
}) {
  const { events } = useAppData();
  const players = participants.filter((p) => p.kind === 'profile');
  const [slot, setSlot] = useState(
    players.some((p) => p.slot === activeSlot) ? activeSlot : (players[0]?.slot ?? activeSlot),
  );
  const player = players.find((p) => p.slot === slot);
  const result = useMemo(
    () => (player?.profileId ? compareWithBest(events, { profileId: player.profileId, gameId, slot, leg }) : null),
    [events, player, gameId, slot, leg],
  );

  const rows = result?.rows.filter((r) => r.record || r.current !== null) ?? [];
  const hasRecord = rows.some((r) => r.record);
  const recordInfo = (r: Comparison) =>
    r.record ? `${date(r.record.ts)}${r.record.shanghaiField ? ` · Feld ${r.record.shanghaiField}` : ''}` : '';

  return (
    <Modal title="Bestleistung" onClose={onClose} wide>
      {players.length > 1 && (
        <div class="chips">
          {players.map((p) => (
            <button key={p.slot} class={p.slot === slot ? 'chip on' : 'chip'} onClick={() => setSlot(p.slot)}>
              {nameOf(p.slot)}
            </button>
          ))}
        </div>
      )}
      {!player ? (
        <p>Für Gäste gibt es keine Bestleistungen.</p>
      ) : !result ? (
        <p class="muted">Keine Angaben.</p>
      ) : (
        <>
          <p class="muted small">
            {nameOf(slot)} · {result.groupLabel} · {result.darts} {result.darts === 1 ? 'Dart' : 'Darts'} in diesem Leg
          </p>
          {!hasRecord && <p>Noch keine Bestleistung in dieser Vergleichsgruppe. Nach dem ersten beendeten Leg gibt es eine.</p>}

          {hasRecord && (
            <>
              <h3 class="subhead">Nach {result.darts} Darts</h3>
              <p class="muted small">Dein Stand jetzt gegen dein Rekord-Leg nach genauso vielen Darts.</p>
              <table class="table table-compact">
                <thead>
                  <tr>
                    <th>Kennzahl</th>
                    <th>Jetzt</th>
                    <th>Rekord-Leg</th>
                    <th>Abw.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.def.key}>
                      <td>{r.def.label}</td>
                      <td>{r.def.endOnly ? '—' : fmtMetric(r.def, r.sameDarts?.current)}</td>
                      <td>{r.def.endOnly ? '—' : fmtMetric(r.def, r.sameDarts?.record)}</td>
                      <td>{r.def.endOnly ? <span class="muted">erst am Ende</span> : <Dev value={r.sameDarts?.deviation} better={r.def.better} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 class="subhead">Endwerte</h3>
              <p class="muted small">Dein aktueller Wert gegen deinen besten je erreichten Wert.</p>
              <table class="table table-compact">
                <thead>
                  <tr>
                    <th>Kennzahl</th>
                    <th>Jetzt</th>
                    <th>Rekord</th>
                    <th>Abw.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.def.key}>
                      <td>{r.def.label}</td>
                      <td>{fmtMetric(r.def, r.current)}</td>
                      <td>
                        {fmtMetric(r.def, r.record?.value)}
                        <div class="muted small">{recordInfo(r)}</div>
                      </td>
                      <td>
                        <Dev value={r.currentDeviation} better={r.def.better} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
