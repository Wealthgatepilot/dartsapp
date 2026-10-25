import type { Participant } from '../engine/events';
import type { Profile } from '../engine/profiles';

export function participantName(p: Participant, profiles: readonly Profile[]): string {
  if (p.kind === 'profile') return profiles.find((x) => x.profileId === p.profileId)?.name ?? 'Unbekannt';
  if (p.kind === 'guest') return p.guestName || 'Gast';
  return `Computer ${p.botLevel ?? ''}`.trim();
}

export function participantColor(p: Participant, profiles: readonly Profile[]): string {
  if (p.kind === 'profile') return profiles.find((x) => x.profileId === p.profileId)?.color ?? '#868e96';
  return '#868e96';
}
