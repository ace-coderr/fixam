import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adapter } from '../adapter';
import type { Capabilities, CatalogueItem, GameAdapter, House, Player, Property, Room, StoredItem } from '../adapter';
import { createPricing, type Pricing } from '../engine/pricing';

/**
 * Loads what every module needs from the game once, and keeps the wallet and
 * storage fresh after anything that changes them. Fixam designs one room at a
 * time; until the property and room pickers exist, it opens the first room of
 * the first property.
 */

interface GameData {
  player: Player;
  wallet: number;
  catalogue: CatalogueItem[];
  catalogueById: ReadonlyMap<string, CatalogueItem>;
  properties: Property[];
  property: Property;
  house: House;
  room: Room;
  storage: StoredItem[];
  capabilities: Capabilities;
  pricing: Pricing;
}

export type GameState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | ({
      status: 'ready';
      adapter: GameAdapter;
      refresh: () => Promise<void>;
      chooseRoom: (propertyId: string, roomId: string) => Promise<void>;
    } & GameData);

const GameContext = createContext<GameState>({ status: 'loading' });

async function loadHouse(propertyId: string, roomId?: string): Promise<{ house: House; room: Room }> {
  const house = await adapter.getHouse(propertyId);
  const rooms = [...house.rooms, house.yard];
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  if (!room) throw new Error('This property has no rooms.');
  return { house, room };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<GameData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    (async () => {
      const [player, wallet, catalogue, properties, storage, capabilities] = await Promise.all([
        adapter.getPlayer(),
        adapter.getWallet(),
        adapter.getCatalogue(),
        adapter.getProperties(),
        adapter.getStorage(),
        adapter.getCapabilities(),
      ]);
      const property = properties[0];
      if (!property) throw new Error('The player owns no property.');
      const { house, room } = await loadHouse(property.id);
      if (!live) return;
      setData({
        player,
        wallet: wallet.naira,
        catalogue,
        catalogueById: new Map(catalogue.map((item) => [item.id, item])),
        properties,
        property,
        house,
        room,
        storage,
        capabilities,
        pricing: createPricing(player.priceMultiplier),
      });
    })().catch(() => {
      if (live) setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const refresh = useCallback(async () => {
    const [wallet, storage] = await Promise.all([adapter.getWallet(), adapter.getStorage()]);
    setData((current) => (current ? { ...current, wallet: wallet.naira, storage } : current));
  }, []);

  const chooseRoom = useCallback(async (propertyId: string, roomId: string) => {
    const { house, room } = await loadHouse(propertyId, roomId);
    setData((current) => {
      const property = current?.properties.find((p) => p.id === propertyId);
      return current && property ? { ...current, property, house, room } : current;
    });
  }, []);

  const value = useMemo<GameState>(() => {
    if (data) return { status: 'ready', adapter, refresh, chooseRoom, ...data };
    if (failed) return { status: 'error', retry: () => setAttempt((n) => n + 1) };
    return { status: 'loading' };
  }, [data, failed, refresh, chooseRoom]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameState {
  return useContext(GameContext);
}
