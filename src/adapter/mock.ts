import type { GameAdapter, PlacedItem, Player, RoomSpec } from './types';

/**
 * In-memory stand-in for the Lagos Life SDK. State lives for the page session
 * only. Every call waits 150–400ms so loading states get exercised.
 */

function latency<T>(value: T): Promise<T> {
  const ms = 150 + Math.random() * 250;
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const player: Player = {
  id: 'player-0042',
  name: 'Adaeze',
  avatarTone: '#8D5A3B',
};

const room: RoomSpec = {
  widthCells: 10,
  heightCells: 13,
  door: { wall: 'south', offset: 7, width: 2 },
  window: { wall: 'north', offset: 3, width: 3 },
};

let naira = 850_000;
let savedLayout: PlacedItem[] = [];
const owned = new Set<string>(['lantern', 'ghana-must-go', 'plastic-chair']);

export const mockAdapter: GameAdapter = {
  getCurrentPlayer: () => latency({ ...player }),

  getWallet: () => latency({ naira }),

  charge(amount, _reason) {
    if (!Number.isFinite(amount) || amount < 0 || amount > naira) {
      return latency({ ok: false });
    }
    naira -= amount;
    return latency({ ok: true });
  },

  getRoom: () => latency({ ...room, door: { ...room.door }, window: { ...room.window } }),

  getOwnedItems: () => latency([...owned]),

  saveLayout(layout) {
    savedLayout = layout.map((item) => ({ ...item }));
    for (const item of savedLayout) owned.add(item.itemId);
    return latency({ ok: true });
  },
};
