import type { GameAdapter } from './types';
import { mockAdapter } from './mock';

/**
 * The active game adapter. This is the only line that changes when Fixam is
 * connected to the live Lagos Life SDK:
 *
 *   export const adapter: GameAdapter = createLagosLifeAdapter(window.LagosLife);
 *
 * Any object that satisfies `GameAdapter` works. Nothing else in the app
 * imports `mock.ts` directly.
 */
export const adapter: GameAdapter = mockAdapter;

export type { GameAdapter, Opening, PlacedItem, Player, RoomSpec, Rotation, Wall } from './types';
