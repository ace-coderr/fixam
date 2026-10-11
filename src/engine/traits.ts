import type { CatalogueItem, Room, RoomType } from '../adapter/types';

/**
 * What an item is and where it belongs, worked out from the live catalogue.
 *
 * The game's tags are read first. When an item arrives without the tags Fixam
 * understands, its category, name and placement fill the gap, so new items
 * from the game are handled sensibly with no change here.
 */

export type Role =
  | 'bed'
  | 'storage'
  | 'seat'
  | 'table'
  | 'light'
  | 'cooling'
  | 'cooking'
  | 'cold'
  | 'counter'
  | 'toilet'
  | 'wash'
  | 'laundry'
  | 'desk'
  | 'screen'
  | 'fun'
  | 'rug'
  | 'plant'
  | 'decor'
  | 'window'
  | 'pet'
  | 'luxury'
  | 'vehicle'
  | 'paint'
  | 'flooring'
  | 'other';

const ROLES = new Set<string>([
  'bed', 'storage', 'seat', 'table', 'light', 'cooling', 'cooking', 'cold', 'counter', 'toilet', 'wash',
  'laundry', 'desk', 'screen', 'fun', 'rug', 'plant', 'decor', 'window', 'pet', 'luxury', 'vehicle',
  'paint', 'flooring',
]);

const TRAITS = new Set(['flat', 'tall', 'near-door']);

/** Tags that say what an item is or how it sits, as opposed to its style. */
export function isTraitTag(tag: string): boolean {
  return ROLES.has(tag) || TRAITS.has(tag);
}

/** Fallbacks for items whose tags don't say what they are. First match wins. */
const NAME_RULES: [RegExp, Role][] = [
  [/paint/i, 'paint'],
  [/terrazzo|parquet|marble floor|tiles?$|flooring/i, 'flooring'],
  [/curtain|blind/i, 'window'],
  [/rug|carpet|\bmat\b/i, 'rug'],
  [/kennel|coop|cage|aquarium|\bpet\b|cat tree/i, 'pet'],
  [/plant|palm|fern|tree|flower/i, 'plant'],
  [/wardrobe|closet|drawer|basket|chest of/i, 'storage'],
  [/bed|mattress/i, 'bed'],
  [/toilet|\bwc\b/i, 'toilet'],
  [/shower|bath|jacuzzi|bucket|drum|basin/i, 'wash'],
  [/washing machine|laundry/i, 'laundry'],
  [/stove|cooker|oven|fryer|grill|microwave/i, 'cooking'],
  [/freezer|fridge|cooler/i, 'cold'],
  [/counter|island|cabinet/i, 'counter'],
  [/fan|\bac\b|air condition/i, 'cooling'],
  [/lamp|light|lantern|sconce|chandelier/i, 'light'],
  [/chair|sofa|couch|bag|stool|bench|throne|ottoman|pouf/i, 'seat'],
  [/desk|workstation|easel|sewing|piano|bookshelf/i, 'desk'],
  [/table/i, 'table'],
  [/\btv\b|screen|cinema|projector/i, 'screen'],
  [/helicopter|jet|yacht|car\b/i, 'vehicle'],
];

const CATEGORY_DEFAULT: Record<CatalogueItem['category'], Role> = {
  Design: 'paint',
  Sleep: 'bed',
  Kitchen: 'counter',
  Bath: 'wash',
  Comfort: 'seat',
  Fun: 'fun',
  Skills: 'desk',
  Light: 'light',
  Decor: 'decor',
  Pets: 'pet',
  Luxury: 'luxury',
};

const roleCache = new WeakMap<CatalogueItem, Role>();

export function roleOf(item: CatalogueItem): Role {
  const cached = roleCache.get(item);
  if (cached) return cached;
  let role: Role | undefined = item.tags.find((t) => ROLES.has(t)) as Role | undefined;
  if (!role && item.placement === 'yard' && item.category === 'Luxury') role = 'vehicle';
  if (!role) role = NAME_RULES.find(([pattern]) => pattern.test(item.name))?.[1];
  if (role === 'paint' && item.category !== 'Design') role = undefined;
  if (!role) role = CATEGORY_DEFAULT[item.category];
  if (item.category === 'Design') role = /floor|terrazzo|parquet|marble|tile/i.test(item.name) || item.tags.includes('flooring') ? 'flooring' : 'paint';
  roleCache.set(item, role);
  return role;
}

/** Paint and floors: applied to the room's surfaces, never placed on the grid. */
export function isFinish(item: CatalogueItem): boolean {
  return item.category === 'Design';
}

/** Lies flat: walkable, and furniture may stand on it. */
export function isFlat(item: CatalogueItem): boolean {
  return item.tags.includes('flat') || roleOf(item) === 'rug';
}

/** Tall pieces may not stand in front of a window. */
export function isTall(item: CatalogueItem): boolean {
  return item.tags.includes('tall') || /wardrobe|closet|bookshelf|freezer|fridge|cabinet|cat tree/i.test(item.name);
}

/** Hangs over a window opening and stretches to its width. */
export function isWindowDressing(item: CatalogueItem): boolean {
  return item.placement === 'wallmount' && roleOf(item) === 'window';
}

/** Pieces you open or face, so their front needs open floor. */
export function needsFrontAccess(item: CatalogueItem): boolean {
  if (item.placement !== 'wall' && item.placement !== 'corner') return false;
  const role = roleOf(item);
  return ['storage', 'screen', 'cooking', 'cold', 'counter', 'laundry', 'desk'].includes(role);
}

export interface PlacementHints {
  door?: 'near' | 'far';
  centre?: boolean;
  near?: Role;
  /** Face the main seat across the room. */
  facesSeat?: boolean;
}

export function hintsFor(item: CatalogueItem, room: Room): PlacementHints {
  if (item.tags.includes('near-door')) return { door: 'near' };
  switch (roleOf(item)) {
    case 'bed':
      return { door: 'far' };
    case 'rug':
      return { centre: true };
    case 'table':
      return { centre: true, near: 'seat' };
    case 'seat':
      return item.w * item.h === 1 ? { near: room.type === 'study' ? 'desk' : 'table' } : {};
    case 'light':
      return { near: room.type === 'bedroom' || room.type === 'unassigned' ? 'bed' : 'seat' };
    case 'screen':
      return { facesSeat: true };
    case 'toilet':
      return { door: 'far' };
    default:
      return {};
  }
}

// Room types -------------------------------------------------------------------

/** Room types a single unassigned room (a self-contain) stands in for. */
const LIVING: RoomType[] = ['parlour', 'bedroom', 'study', 'kitchen'];

/** True when the item belongs in this kind of room. Never a toilet in the parlour. */
export function fitsRoomType(item: CatalogueItem, type: RoomType): boolean {
  if (item.roomTypes.includes(type)) return true;
  if (type === 'unassigned') return item.roomTypes.some((t) => LIVING.includes(t));
  return false;
}

/** Roles every room of a type needs before anything else is bought. */
export const MUST_HAVES: Record<RoomType, Role[]> = {
  unassigned: ['bed', 'seat', 'light'],
  bedroom: ['bed', 'light'],
  parlour: ['seat', 'table', 'light'],
  kitchen: ['cooking', 'cold', 'counter'],
  bath: ['toilet', 'wash'],
  study: ['desk', 'seat', 'light'],
  yard: [],
};

/** How much of the usable floor a finished room of each type covers. */
export const COVERAGE_BANDS: Record<RoomType, { low: number; high: number }> = {
  parlour: { low: 0.45, high: 0.6 },
  bedroom: { low: 0.45, high: 0.6 },
  study: { low: 0.45, high: 0.6 },
  unassigned: { low: 0.45, high: 0.6 },
  kitchen: { low: 0.35, high: 0.5 },
  bath: { low: 0.25, high: 0.4 },
  yard: { low: 0.1, high: 0.25 },
};

/**
 * Usable floor cells per copy of a role. A small room gets one of most
 * things; a large one gets more seats, counters and rugs, in proportion.
 */
const CELLS_PER_COPY: Record<Role, number> = {
  bed: 50,
  storage: 30,
  seat: 7,
  table: 25,
  light: 40,
  cooling: 50,
  cooking: 70,
  cold: 60,
  counter: 8,
  toilet: 90,
  wash: 25,
  laundry: 100,
  desk: 30,
  screen: 80,
  fun: 30,
  rug: 14,
  plant: 10,
  decor: 12,
  window: 1,
  pet: 40,
  luxury: 60,
  vehicle: 50,
  paint: Infinity,
  flooring: Infinity,
  other: 30,
};

const MAX_COPIES = 40;

/** How many pieces of one role a room can take. */
export function roleCap(role: Role, room: Room, usable: number): number {
  if (role === 'window') return room.windows.length;
  if (role === 'paint' || role === 'flooring') return 1;
  // Even a small room can take a second rug, plant or chair.
  const floor = FILLER_ROLES.has(role) && role !== 'table' ? 2 : 1;
  return Math.min(MAX_COPIES, Math.max(floor, Math.floor(usable / CELLS_PER_COPY[role])));
}

/** How many copies of one item a room can take. Statement pieces (3+ stars) are one-offs. */
export function itemCap(item: CatalogueItem, room: Room, usable: number): number {
  if (item.stars >= 3) return 1;
  return roleCap(roleOf(item), room, usable);
}

/** Importance of a role in a room type, 1–10. */
export function rolePriority(role: Role, type: RoomType): number {
  if (MUST_HAVES[type].includes(role)) return 9;
  const base: Partial<Record<Role, number>> = {
    storage: 7,
    cooling: 7,
    table: 6,
    seat: 6,
    light: 6,
    screen: 5,
    wash: 6,
    laundry: 5,
    counter: 6,
    cold: 6,
    cooking: 6,
    desk: 5,
    window: 5,
    rug: 4,
    plant: 3,
    decor: 3,
    fun: 4,
    pet: 3,
    luxury: 3,
    vehicle: 4,
  };
  return base[role] ?? 4;
}

/** Roles that make sense in multiples to fill out a room. Nobody needs a sixth stove. */
const FILLER_ROLES = new Set<Role>(['rug', 'plant', 'seat', 'table', 'decor', 'storage', 'counter', 'fun', 'pet', 'wash']);

/** Cheap, small or flat pieces the density pass uses to fill out a sparse room. */
export function isSupporting(item: CatalogueItem): boolean {
  if (isFinish(item) || item.stars > 1 || !FILLER_ROLES.has(roleOf(item))) return false;
  return isFlat(item) || item.w * item.h <= 2;
}
