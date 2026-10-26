import { BoardTest } from './BoardTest';
import { DataProvider } from './data';
import { PwaProvider } from './pwa';
import { useRoute } from './router';
import { CricketSetup } from './screens/CricketSetup';
import { DoublesSetup } from './screens/DoublesSetup';
import { AtcSetup } from './screens/AtcSetup';
import { BobsSetup } from './screens/BobsSetup';
import { HalveItSetup } from './screens/HalveItSetup';
import { KillerSetup } from './screens/KillerSetup';
import { FinishSetup } from './screens/FinishSetup';
import { CountUpSetup } from './screens/CountUpSetup';
import { Game } from './screens/Game';
import { Home } from './screens/Home';
import { Profiles } from './screens/Profiles';
import { Settings } from './screens/Settings';
import { ShanghaiSetup } from './screens/ShanghaiSetup';
import { History } from './screens/History';
import { Stats } from './screens/Stats';
import { X01Setup } from './screens/X01Setup';

export function App() {
  return (
    <PwaProvider>
      <DataProvider>
        <Screens />
      </DataProvider>
    </PwaProvider>
  );
}

function Screens() {
  const route = useRoute();
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'profiles':
      return <Profiles />;
    case 'setup':
      return <X01Setup />;
    case 'cricket':
      return <CricketSetup />;
    case 'shanghai':
      return <ShanghaiSetup />;
    case 'doubles':
      return <DoublesSetup />;
    case 'countup':
      return <CountUpSetup />;
    case 'atc':
      return <AtcSetup />;
    case 'bobs':
      return <BobsSetup />;
    case 'halveit':
      return <HalveItSetup />;
    case 'one21':
      // 121 in der neuen Form (zufällige Finishes); die alte Form wird nicht mehr neu angelegt
      return <FinishSetup />;
    case 'killer':
      return <KillerSetup />;
    case 'stats':
      return <Stats />;
    case 'history':
      return <History />;
    case 'review':
      return <Game key={'r' + route.gameId} gameId={route.gameId} review />;
    case 'game':
      return <Game key={route.gameId} gameId={route.gameId} />;
    case 'settings':
      return <Settings />;
    case 'boardtest':
      return <BoardTest />;
  }
}
