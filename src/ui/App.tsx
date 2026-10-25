import { BoardTest } from './BoardTest';
import { DataProvider } from './data';
import { PwaProvider } from './pwa';
import { useRoute } from './router';
import { CricketSetup } from './screens/CricketSetup';
import { Game } from './screens/Game';
import { Home } from './screens/Home';
import { Profiles } from './screens/Profiles';
import { Settings } from './screens/Settings';
import { ShanghaiSetup } from './screens/ShanghaiSetup';
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
    case 'game':
      return <Game key={route.gameId} gameId={route.gameId} />;
    case 'settings':
      return <Settings />;
    case 'boardtest':
      return <BoardTest />;
  }
}
