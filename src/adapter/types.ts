/**
 * The contract between Fixam and the host game.
 *
 * Everything Fixam needs from Lagos Life goes through this interface. The app
 * never talks to the game any other way, so supporting a new host means writing
 * one object that satisfies `GameAdapter`.
 */

export interface Player {
  id: string;
  name: string;
  /** CSS colour used for the player's avatar chip. */
  avatarTone: string;
}

export type Wall = 'north' | 'east' | 'south' | 'west';

/** A gap in a wall. `offset` and `width` are measured in cells along that wall,
 *  from the west end (north/south walls) or the north end (east/west walls). */
export interface Opening {
  wall: Wall;
  offset: number;
  width: number;
}

/** The player's room as a grid. One cell is 50cm. North is the top of the plan. */
export interface RoomSpec {
  widthCells: number;
  heightCells: number;
  door: Opening;
  window: Opening;
}

/**
 * Quarter turns clockwise. 0 means the item's back is against the north wall
 * and it faces south; 1 means its back is to the east, and so on.
 */
export type Rotation = 0 | 1 | 2 | 3;

/**
 * One item in a finished layout.
 * `x`, `y`, `w`, `h` are the occupied footprint in cells, after rotation.
 * Wall-mounted items report the strip of floor cells directly beneath them,
 * with `rot` telling you which wall they hang on.
 */
export interface PlacedItem {
  uid: string;
  itemId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: Rotation;
  layer: 'floor' | 'flat' | 'wall';
}

export interface GameAdapter {
  getCurrentPlayer(): Promise<Player>;
  getWallet(): Promise<{ naira: number }>;
  charge(amount: number, reason: string): Promise<{ ok: boolean }>;
  getRoom(): Promise<RoomSpec>;
  /** Catalogue ids the player already owns. */
  getOwnedItems(): Promise<string[]>;
  saveLayout(layout: PlacedItem[]): Promise<{ ok: boolean }>;
}
