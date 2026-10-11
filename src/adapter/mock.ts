import { createPricing, priceTierFor } from '../engine/pricing';
import { mockCatalogue } from './mockCatalogue';
import type {
  Capabilities,
  CatalogueItem,
  GameAdapter,
  House,
  Player,
  Property,
  StoredItem,
} from './types';

/**
 * In-memory stand-in for the Lagos Life SDK. State lives for the page session
 * only, and every call waits 150–400ms so loading states get exercised.
 *
 * One mock player per price tier. Each owns two properties: a self-contain
 * and a Banana Island mansion.
 */

export type MockTier = 'starter' | 'mid' | 'big-man';

export interface MockOptions {
  tier?: MockTier;
  capabilities?: Capabilities;
  /** Skip the artificial delay, for tests. */
  instant?: boolean;
}

const PLAYERS: Record<MockTier, { name: string; avatarTone: string; netWorth: number; wallet: number }> = {
  starter: { name: 'Adaeze', avatarTone: '#8D5A3B', netWorth: 2_500_000, wallet: 350_000 },
  mid: { name: 'Tunde', avatarTone: '#6B4A2E', netWorth: 850_000_000, wallet: 40_000_000 },
  'big-man': { name: 'Chief Obi', avatarTone: '#5A3A22', netWorth: 250_000_000_000, wallet: 20_000_000_000 },
};

/** Bought, never placed. Each tier keeps one piece that clashes with most styles, to sell. */
const STORAGE: Record<MockTier, string[]> = {
  starter: ['plastic-chair', 'plastic-chair', 'foam-mattress', 'cooler-box', 'standing-fan', 'owambe-carpet'],
  mid: ['velvet-sofa', 'spring-bed', 'wc-toilet', 'persian-rug', 'party-speaker'],
  'big-man': ['lekki-king-bed', 'diamond-studded-throne', 'jacuzzi', 'air-fryer', 'bunk-bed'],
};

export const MOCK_PROPERTIES: Property[] = [
  { id: 'yaba-self-contain', name: 'Self-contain, Yaba', tier: 'self-contain', widthCells: 7, heightCells: 7, basePrice: 1_200_000 },
  { id: 'banana-island-mansion', name: 'Mansion, Banana Island', tier: 'mansion', widthCells: 14, heightCells: 14, basePrice: 900_000_000 },
];

const HOUSES: Record<string, House> = {
  'yaba-self-contain': {
    name: 'Self-contain, Yaba',
    tier: 'self-contain',
    rooms: [
      {
        id: 'yaba-room',
        label: 'Room',
        widthCells: 7,
        heightCells: 7,
        doors: [{ wall: 'south', offset: 5, width: 1 }],
        windows: [{ wall: 'north', offset: 2, width: 2 }],
        floor: null,
        wallPaint: null,
        type: 'unassigned',
      },
    ],
    yard: {
      id: 'yaba-compound',
      label: 'Shared compound',
      widthCells: 6,
      heightCells: 6,
      doors: [{ wall: 'north', offset: 1, width: 1 }],
      windows: [],
      floor: null,
      wallPaint: null,
      type: 'yard',
    },
  },
  // 14×14 footprint: parlour and bedroom across the front, kitchen and bath behind.
  'banana-island-mansion': {
    name: 'Mansion, Banana Island',
    tier: 'mansion',
    rooms: [
      {
        id: 'mansion-parlour',
        label: 'Parlour',
        widthCells: 9,
        heightCells: 8,
        doors: [
          { wall: 'west', offset: 3, width: 2 },
          { wall: 'east', offset: 2, width: 1 },
          { wall: 'south', offset: 4, width: 1 },
        ],
        windows: [
          { wall: 'north', offset: 1, width: 3 },
          { wall: 'north', offset: 5, width: 3 },
        ],
        floor: 'floor-terrazzo',
        wallPaint: 'paint-classic-cream',
        type: 'parlour',
      },
      {
        id: 'mansion-bedroom',
        label: 'Main bedroom',
        widthCells: 5,
        heightCells: 8,
        doors: [{ wall: 'west', offset: 2, width: 1 }],
        windows: [{ wall: 'north', offset: 1, width: 3 }, { wall: 'east', offset: 3, width: 2 }],
        floor: null,
        wallPaint: null,
        type: 'bedroom',
      },
      {
        id: 'mansion-kitchen',
        label: 'Kitchen',
        widthCells: 8,
        heightCells: 6,
        doors: [{ wall: 'north', offset: 4, width: 1 }, { wall: 'south', offset: 1, width: 1 }],
        windows: [{ wall: 'west', offset: 2, width: 2 }],
        floor: null,
        wallPaint: null,
        type: 'kitchen',
      },
      {
        id: 'mansion-bath',
        label: 'Bathroom',
        widthCells: 6,
        heightCells: 6,
        doors: [{ wall: 'north', offset: 1, width: 1 }],
        windows: [{ wall: 'east', offset: 2, width: 1 }],
        floor: null,
        wallPaint: null,
        type: 'bath',
      },
    ],
    yard: {
      id: 'mansion-yard',
      label: 'Yard',
      widthCells: 14,
      heightCells: 10,
      doors: [{ wall: 'north', offset: 1, width: 2 }],
      windows: [],
      floor: null,
      wallPaint: null,
      type: 'yard',
    },
  },
};

const FULL: Capabilities = { canBuy: true, canPlace: true };

export function createMockAdapter(options: MockOptions = {}): GameAdapter {
  const tier = options.tier ?? 'starter';
  const capabilities = { ...(options.capabilities ?? FULL) };
  const profile = PLAYERS[tier];
  const player: Player = {
    id: `mock-${tier}`,
    name: profile.name,
    avatarTone: profile.avatarTone,
    netWorth: profile.netWorth,
    priceMultiplier: priceTierFor(profile.netWorth).multiplier,
  };
  const pricing = createPricing(player.priceMultiplier);
  const byId = new Map<string, CatalogueItem>(mockCatalogue.map((item) => [item.id, item]));

  let naira = profile.wallet;
  let nextUid = 1;
  let storage: StoredItem[] = STORAGE[tier].map((itemId) => ({ uid: `stored-${nextUid++}`, itemId }));
  const houses: Record<string, House> = structuredClone(HOUSES);

  const respond = <T>(value: T): Promise<T> => {
    if (options.instant) return Promise.resolve(value);
    const ms = 150 + Math.random() * 250;
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
  };

  return {
    getPlayer: () => respond({ ...player }),

    getWallet: () => respond({ naira }),

    charge(amount) {
      if (!Number.isFinite(amount) || amount < 0 || amount > naira) return respond({ ok: false });
      naira -= amount;
      return respond({ ok: true });
    },

    getCatalogue: () => respond(mockCatalogue.map((item) => ({ ...item, tags: [...item.tags], roomTypes: [...item.roomTypes] }))),

    getProperties: () => respond(MOCK_PROPERTIES.map((p) => ({ ...p }))),

    getHouse(propertyId) {
      const house = houses[propertyId];
      if (!house) return Promise.reject(new Error(`No property ${propertyId}`));
      return respond(structuredClone(house));
    },

    getStorage: () => respond(storage.map((s) => ({ ...s }))),

    getCapabilities: () => respond({ ...capabilities }),

    buyItems(itemIds) {
      if (!capabilities.canBuy) return respond({ ok: false, stored: [] });
      const items = itemIds.map((id) => byId.get(id));
      if (items.some((item) => !item)) return respond({ ok: false, stored: [] });
      const cost = items.reduce((sum, item) => sum + pricing.price(item as CatalogueItem), 0);
      if (cost > naira) return respond({ ok: false, stored: [] });
      naira -= cost;
      const stored = itemIds.map((itemId) => ({ uid: `stored-${nextUid++}`, itemId }));
      storage = [...storage, ...stored];
      return respond({ ok: true, stored });
    },

    placeItems(roomId, layout, finishes) {
      if (!capabilities.canPlace) return respond({ ok: false });
      const room = Object.values(houses)
        .flatMap((h) => [...h.rooms, h.yard])
        .find((r) => r.id === roomId);
      const storedUids = new Set(storage.map((s) => s.uid));
      if (!room || layout.some((p) => !storedUids.has(p.uid))) return respond({ ok: false });
      const placed = new Set(layout.map((p) => p.uid));
      storage = storage.filter((s) => !placed.has(s.uid));
      // Applying a finish uses up one stored tin of paint or pack of flooring.
      for (const finish of [finishes.floor, finishes.wallPaint]) {
        if (!finish) continue;
        const index = storage.findIndex((s) => s.itemId === finish);
        if (index >= 0) storage.splice(index, 1);
      }
      if (finishes.floor) room.floor = finishes.floor;
      if (finishes.wallPaint) room.wallPaint = finishes.wallPaint;
      return respond({ ok: true });
    },
  };
}

/** The default mock: a starter-tier player whose game lets Fixam buy and place. */
export const mockAdapter: GameAdapter = createMockAdapter();
