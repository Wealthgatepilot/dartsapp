// Spielansicht: wählt je nach Modus die passende Ansicht.

import { useMemo } from 'preact/hooks';
import { gameEventsOf } from '../../engine/events';
import { listGames, type GameInfo } from '../../engine/games';
import { listProfiles } from '../../engine/profiles';
import { TopBar } from '../components';
import { useAppData } from '../data';
import { participantColor, participantName } from '../names';
import { href } from '../router';
import { AtcGame } from './AtcGame';
import { BobsGame } from './BobsGame';
import { HalveItGame } from './HalveItGame';
import { FinishGame } from './FinishGame';
import { KillerGame } from './KillerGame';
import { One21Game } from './One21Game';
import { CountUpGame } from './CountUpGame';
import { CricketGame } from './CricketGame';
import { DoublesGame } from './DoublesGame';
import { ShanghaiGame } from './ShanghaiGame';
import { StartOrder } from './StartOrder';
import { X01Game } from './X01Game';

export interface ModeViewProps {
  game: GameInfo;
  gameEvents: ReturnType<typeof gameEventsOf>;
  nameOf: (slot: number) => string;
  colorOf: (slot: number) => string;
}

export function Game({ gameId }: { gameId: string }) {
  const { events } = useAppData();
  const profiles = useMemo(() => listProfiles(events), [events]);
  const game = useMemo(() => listGames(events).find((g) => g.created.gameId === gameId), [events, gameId]);
  const gameEvents = useMemo(() => gameEventsOf(events, gameId), [events, gameId]);

  if (!game) {
    return (
      <div class="page">
        <TopBar title="Spiel" back={href({ name: 'home' })} />
        <p>Dieses Spiel gibt es nicht.</p>
      </div>
    );
  }

  const participant = (slot: number) => game.created.participants.find((p) => p.slot === slot)!;
  const props: ModeViewProps = {
    game,
    gameEvents,
    nameOf: (slot) => participantName(participant(slot), profiles),
    colorOf: (slot) => participantColor(participant(slot), profiles),
  };
  // Erst festlegen, wer beginnt (Ausbullen oder Münzwurf), dann spielen.
  if (!game.orderDecided) return <StartOrder {...props} />;
  switch (game.created.mode) {
    case 'x01':
      return <X01Game {...props} />;
    case 'cricket':
      return <CricketGame {...props} />;
    case 'shanghai':
      return <ShanghaiGame {...props} />;
    case 'doubles':
      return <DoublesGame {...props} />;
    case 'countup':
      return <CountUpGame {...props} />;
    case 'atc':
      return <AtcGame {...props} />;
    case 'bobs':
      return <BobsGame {...props} />;
    case 'halveit':
      return <HalveItGame {...props} />;
    case 'one21':
      return <One21Game {...props} />;
    case 'killer':
      return <KillerGame {...props} />;
    case 'finish':
      return <FinishGame {...props} />;
  }
}
