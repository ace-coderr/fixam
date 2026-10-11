import { Suspense, useEffect } from 'react';
import { naira } from './lib/naira';
import { defaultModule, moduleFor } from './modules/registry';
import { GameProvider, useGame } from './shell/GameContext';
import { navigate, useHashPath } from './shell/router';

function Header() {
  const game = useGame();
  return (
    <header className="topbar">
      <span className="wordmark">Fixam</span>
      {game.status === 'ready' && (
        <div className="topbar-player">
          <span className="wallet" aria-label={`Wallet balance ${naira(game.wallet)}`}>
            {naira(game.wallet)}
          </span>
          <span className="avatar" style={{ background: game.player.avatarTone }} aria-label={game.player.name}>
            {game.player.name.charAt(0)}
          </span>
        </div>
      )}
    </header>
  );
}

function Outlet() {
  const path = useHashPath();
  const game = useGame();
  const active = moduleFor(path);

  useEffect(() => {
    if (!active) navigate(defaultModule.path, { replace: true });
  }, [active]);

  if (game.status === 'loading') {
    return <p className="status-line" role="status">Opening your flat…</p>;
  }
  if (game.status === 'error') {
    return (
      <div className="notice" role="alert">
        <p>Fixam couldn’t load your flat from the game. Check your connection, then try again.</p>
        <button type="button" className="button-secondary" onClick={game.retry}>
          Try again
        </button>
      </div>
    );
  }

  const Screen = (active ?? defaultModule).screen;
  return (
    <Suspense fallback={<p className="status-line" role="status">Loading…</p>}>
      <Screen />
    </Suspense>
  );
}

export default function App() {
  return (
    <GameProvider>
      <div className="app">
        <Header />
        <main>
          <Outlet />
        </main>
      </div>
    </GameProvider>
  );
}
