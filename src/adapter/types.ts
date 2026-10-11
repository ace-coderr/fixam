/**
 * The contract between Fixam and the host game.
 *
 * Everything Fixam knows about the player, their houses and the furniture on
 * sale comes through this interface. Fixam has no catalogue of its own: items
 * the game adds later show up here and work with no change to Fixam.
 */

/** Item categories, exactly as the game names them. */
export type Category =
  | 'Design'
  | 'Sleep'
  | 'Kitchen'
  | 'Bath'
  | 'Comfort'
  | 'Fun'
  | 'Skills'
  | 'Light'
  | 'Decor'
  | 'Pets'
  | 'Luxury';

/**
 * floor: anywhere in the room.  wall: back flush against a wall.
 * corner: touching two walls.  wallmount: hangs on a wall, takes no floor.
 * yard: outdoors only.
 */
export type Placement = 'floor' | 'wall' | 'wallmount' | 'corner' | 'yard';

export type RoomType = 'parlour' | 'bedroom' | 'kitchen' | 'bath' | 'study' | 'yard' | 'unassigned';

/**
 * One item on sale. Sizes are in grid cells: `w` runs along the wall the item
 * backs onto, `h` is its depth into the room. Design items (paint, floors) are
 * surface finishes and have no footprint.
 *
 * `tags` mixes style words (luxe, budget, soft, bold…) with what the item is
 * (bed, seat, rug, tall…). Fixam reads both and copes when either is missing.
 */
export interface CatalogueItem {
  id: string;
  name: string;
  /** Price before the player's tier multiplier. Never shown to the player as-is. */
  basePrice: number;
  w: number;
  h: number;
  category: Category;
  placement: Placement;
  /** Luxury tier, 0–4. Feeds the player's status. */
  stars: number;
  tags: string[];
  rotatable: boolean;
  /** Rooms this item belongs in. */
  roomTypes: RoomType[];
  /** True when confirmed against the live game. */
  verified: boolean;
}

export interface Player {
  id: string;
  name: string;
  /** CSS colour used for the player's avatar chip. */
  avatarTone: string;
  netWorth: number;
  /** Every displayed price is basePrice × this. Set by the game from net worth. */
  priceMultiplier: number;
}

export type Wall = 'north' | 'east' | 'south' | 'west';

/** A gap in a wall. `offset` and `width` are in cells along that wall,
 *  from the west end (north/south walls) or the north end (east/west walls). */
export interface Opening {
  wall: Wall;
  offset: number;
  width: number;
}

/** One room of a house, as a grid with north at the top. Walls are fixed. */
export interface Room {
  id: string;
  label: string;
  widthCells: number;
  heightCells: number;
  doors: Opening[];
  windows: Opening[];
  /** Catalogue id of the current floor finish, if any. */
  floor: string | null;
  /** Catalogue id of the current wall paint, if any. */
  wallPaint: string | null;
  type: RoomType;
}

export interface House {
  name: string;
  tier: string;
  rooms: Room[];
  yard: Room;
}

/** A property the player owns. */
export interface Property {
  id: string;
  name: string;
  /** Housing tier, such as 'self-contain' or 'mansion'. */
  tier: string;
  widthCells: number;
  heightCells: number;
  /** Before the player's price multiplier, like item prices. */
  basePrice: number;
}

/** Something the player bought but hasn't placed anywhere. */
export interface StoredItem {
  uid: string;
  itemId: string;
}

/** Quarter turns clockwise, in degrees. 0 means the item's back is to the north wall. */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * One item in a finished layout.
 * `x`, `y`, `w`, `h` are the occupied footprint in cells, after rotation.
 * Wall-mounted items report the strip of floor cells directly beneath them,
 * with `rotation` telling you which wall they hang on.
 */
export interface PlacedItem {
  uid: string;
  itemId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: Rotation;
  layer: 'floor' | 'flat' | 'wall';
}

/** Surface finishes for a room: catalogue ids of Design items. */
export interface Finishes {
  floor: string | null;
  wallPaint: string | null;
}

/** What the host lets Fixam do on the player's behalf. */
export interface Capabilities {
  canBuy: boolean;
  canPlace: boolean;
}

export interface GameAdapter {
  getPlayer(): Promise<Player>;
  getWallet(): Promise<{ naira: number }>;
  /** Charges the player's own wallet. Fixam never holds a balance. */
  charge(amount: number, reason: string): Promise<{ ok: boolean }>;
  /** Everything on sale, live from the game. */
  getCatalogue(): Promise<CatalogueItem[]>;
  getProperties(): Promise<Property[]>;
  getHouse(propertyId: string): Promise<House>;
  getStorage(): Promise<StoredItem[]>;
  getCapabilities(): Promise<Capabilities>;
  /** Buys items through the game's own shop at displayed prices. They land in storage. Needs canBuy. */
  buyItems(itemIds: string[]): Promise<{ ok: boolean; stored: StoredItem[] }>;
  /** Places stored items and applies finishes in one room. Needs canPlace. */
  placeItems(roomId: string, layout: PlacedItem[], finishes: Finishes): Promise<{ ok: boolean }>;
}
