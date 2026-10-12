import { Suspense, useEffect } from 'react';
import { Header } from './components/ui';
import { defaultModule, moduleFor } from './modules/registry';
import { GameProvider, useGame } from './shell/GameContext';
import { navigate, useHashPath } from './shell/router';

/** Each module draws its own header, since only it knows where "back" goes. */
function Outlet() {
  const path = useHashPath();
  const game = useGame();
  const active = moduleFor(path);

  useEffect(() => {
    if (!active) navigate(defaultModule.path, { replace: true });
  }, [active]);

  if (game.status === 'loading') {
    return (
      <>
        <Header />
        <p className="status-line" role="status">
          Opening Fixam…
        </p>
      </>
    );
  }
  if (game.status === 'error') {
    return (
      <>
        <Header />
        <div className="notice" role="alert">
          <p>Fixam couldn’t load your homes from the game. Check your connection, then try again.</p>
          <button type="button" className="button-secondary" onClick={game.retry}>
            Try again
          </button>
        </div>
      </>
    );
  }

  const Screen = (active ?? defaultModule).screen;
  return (
    <Suspense fallback={<Header />}>
      <Screen />
    </Suspense>
  );
}

export default function App() {
  return (
    <GameProvider>
      <div className="app">
        <Outlet />
      </div>
    </GameProvider>
  );
}
