import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adapter } from '../adapter';
import type { Capabilities, CatalogueItem, GameAdapter, Player, Property, StoredItem } from '../adapter';
import { createPricing, type Pricing } from '../engine/pricing';

/**
 * Loads what every module needs from the game once, and keeps the wallet,
 * storage and properties fresh after anything that changes them.
 */

interface GameData {
  player: Player;
  wallet: number;
  catalogue: CatalogueItem[];
  catalogueById: ReadonlyMap<string, CatalogueItem>;
  properties: Property[];
  storage: StoredItem[];
  capabilities: Capabilities;
  pricing: Pricing;
}

export type GameState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | ({ status: 'ready'; adapter: GameAdapter; refresh: () => Promise<void> } & GameData);

const GameContext = createContext<GameState>({ status: 'loading' });

export function GameProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<GameData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    Promise.all([
      adapter.getPlayer(),
      adapter.getWallet(),
      adapter.getCatalogue(),
      adapter.getProperties(),
      adapter.getStorage(),
      adapter.getCapabilities(),
    ])
      .then(([player, wallet, catalogue, properties, storage, capabilities]) => {
        if (!live) return;
        setData({
          player,
          wallet: wallet.naira,
          catalogue,
          catalogueById: new Map(catalogue.map((item) => [item.id, item])),
          properties,
          storage,
          capabilities,
          pricing: createPricing(player.priceMultiplier),
        });
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const refresh = useCallback(async () => {
    const [wallet, storage, properties] = await Promise.all([adapter.getWallet(), adapter.getStorage(), adapter.getProperties()]);
    setData((current) => (current ? { ...current, wallet: wallet.naira, storage, properties } : current));
  }, []);

  const value = useMemo<GameState>(() => {
    if (data) return { status: 'ready', adapter, refresh, ...data };
    if (failed) return { status: 'error', retry: () => setAttempt((n) => n + 1) };
    return { status: 'loading' };
  }, [data, failed, refresh]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameState {
  return useContext(GameContext);
}
