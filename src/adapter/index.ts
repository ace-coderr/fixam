import type { GameAdapter } from './types';
import { mockAdapter } from './mock';

/**
 * The active game adapter. This is the only line that changes when Fixam is
 * connected to the live Lagos Life SDK:
 *
 *   export const adapter: GameAdapter = createLagosLifeAdapter(window.LagosLife);
 *
 * Any object that satisfies `GameAdapter` works. Nothing else in the app
 * imports `mock.ts` or `mockCatalogue.ts` directly. To try another price tier
 * or execution mode against the mock, use createMockAdapter({ tier, capabilities }).
 */
export const adapter: GameAdapter = mockAdapter;

export type {
  Capabilities,
  CatalogueItem,
  Category,
  Finishes,
  GameAdapter,
  House,
  Opening,
  PlacedItem,
  Placement,
  Player,
  Property,
  Room,
  RoomType,
  Rotation,
  StoredItem,
  Wall,
} from './types';
