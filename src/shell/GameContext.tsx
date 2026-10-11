import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adapter } from '../adapter';
import type { GameAdapter, Player, RoomSpec } from '../adapter';

/**
 * Loads what every module needs from the game once, and keeps the wallet and
 * owned items fresh after anything that changes them.
 */

export type GameState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | {
      status: 'ready';
      adapter: GameAdapter;
      player: Player;
      wallet: number;
      room: RoomSpec;
      owned: string[];
      refresh: () => Promise<void>;
    };

const GameContext = createContext<GameState>({ status: 'loading' });

export function GameProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<{ player: Player; wallet: number; room: RoomSpec; owned: string[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    Promise.all([adapter.getCurrentPlayer(), adapter.getWallet(), adapter.getRoom(), adapter.getOwnedItems()])
      .then(([player, wallet, room, owned]) => {
        if (live) setData({ player, wallet: wallet.naira, room, owned });
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const refresh = useCallback(async () => {
    const [wallet, owned] = await Promise.all([adapter.getWallet(), adapter.getOwnedItems()]);
    setData((current) => (current ? { ...current, wallet: wallet.naira, owned } : current));
  }, []);

  const value = useMemo<GameState>(() => {
    if (data) return { status: 'ready', adapter, ...data, refresh };
    if (failed) return { status: 'error', retry: () => setAttempt((n) => n + 1) };
    return { status: 'loading' };
  }, [data, failed, refresh]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameState {
  return useContext(GameContext);
}
