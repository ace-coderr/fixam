import type { PlacedItem, RoomSpec, Rotation, Wall } from '../adapter/types';
import type { CatalogueItem } from '../data/catalogue';

/**
 * Grid placement with hard constraints.
 *
 * Rules every layout obeys:
 *  - wall items have their back flush to a wall; corner items touch two walls
 *  - nothing stands in the door's clearance zone, wall-mounts never cover the door
 *  - tall items never stand directly in front of the window
 *  - solid items never overlap each other; flat items (rugs) never overlap each other
 *  - every solid item can be reached on foot from the door
 *
 * Search is greedy best-first with depth-first backtracking under a step
 * budget. A seeded RNG jitters candidate scores, so a new seed gives a
 * different layout that still satisfies every rule. When an item keeps
 * failing after several attempts it is dropped and the rest are solved again.
 *
 * No React, no DOM, no globals: same inputs, same output.
 */

export interface SolverInput {
  uid: string;
  item: CatalogueItem;
}

export type SolveResult =
  | { ok: true; layout: PlacedItem[]; dropped: string[]; seed: number }
  | { ok: false; reason: string; dropped: string[]; seed: number };

export interface SolveOptions {
  /** Fresh attempts with new jitter before the most troublesome item is dropped. */
  attempts?: number;
  /** Placement steps allowed per attempt before giving up on it. */
  stepBudget?: number;
  /** Valid candidates explored per item before backtracking further. */
  branching?: number;
}

const WALLS: Wall[] = ['north', 'east', 'south', 'west'];
const ROTATIONS: Rotation[] = [0, 1, 2, 3];
const JITTER = 4;
const EMPTY = -1;

export function wallOf(rot: Rotation): Wall {
  return WALLS[rot] as Wall;
}

export function rotationFor(wall: Wall): Rotation {
  return WALLS.indexOf(wall) as Rotation;
}

/** Footprint of an item once rotated. */
export function footprint(item: Pick<CatalogueItem, 'w' | 'h'>, rot: Rotation): { w: number; h: number } {
  return rot % 2 === 0 ? { w: item.w, h: item.h } : { w: item.h, h: item.w };
}

export function wallLength(room: RoomSpec, wall: Wall): number {
  return wall === 'north' || wall === 'south' ? room.widthCells : room.heightCells;
}

/** Depth of the clear zone kept in front of the door. */
export function doorClearance(room: RoomSpec): number {
  return Math.max(2, room.door.width);
}

/** Seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixSeed(...parts: number[]): number {
  let h = 2166136261;
  for (const part of parts) {
    h ^= part >>> 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/** Cells covered by a strip of `depth` cells running along `wall` from `offset`. */
function stripRect(room: RoomSpec, wall: Wall, offset: number, length: number, depth: number) {
  const W = room.widthCells;
  const H = room.heightCells;
  switch (wall) {
    case 'north':
      return { x: offset, y: 0, w: length, h: depth };
    case 'south':
      return { x: offset, y: H - depth, w: length, h: depth };
    case 'west':
      return { x: 0, y: offset, w: depth, h: length };
    case 'east':
      return { x: W - depth, y: offset, w: depth, h: length };
  }
}

export function validateRoom(room: RoomSpec): string | null {
  const { widthCells: W, heightCells: H, door, window } = room;
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < 4 || H < 4) {
    return 'The room is too small to furnish. It needs to be at least 2m by 2m.';
  }
  for (const [label, opening] of [['door', door], ['window', window]] as const) {
    const len = wallLength(room, opening.wall);
    if (opening.width < 1 || opening.offset < 0 || opening.offset + opening.width > len) {
      return `The room's ${label} sits outside its wall.`;
    }
  }
  if (
    door.wall === window.wall &&
    door.offset < window.offset + window.width &&
    window.offset < door.offset + door.width
  ) {
    return 'The room’s door and window overlap.';
  }
  return null;
}

interface Candidate {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: Rotation;
}

type Layer = PlacedItem['layer'];

function layerOf(item: CatalogueItem): Layer {
  if (item.placement === 'wallmount') return 'wall';
  return item.flat ? 'flat' : 'floor';
}

/** Items whose front must face open floor (you open them, or look at them). */
function needsFrontAccess(item: CatalogueItem): boolean {
  return (
    (item.placement === 'wall' || item.placement === 'corner') &&
    (item.category === 'storage' || item.category === 'media' || item.category === 'desk' || item.category === 'kitchen')
  );
}

/** Mutable occupancy grid for one room. Shared by the solver and the validator. */
class Grid {
  readonly W: number;
  readonly H: number;
  readonly solid: Int16Array;
  readonly flat: Int16Array;
  readonly doorZone: Uint8Array;
  readonly windowBand: Uint8Array;
  readonly mounts: Record<Wall, Int16Array>;
  readonly doorStarts: number[] = [];

  constructor(readonly room: RoomSpec) {
    this.W = room.widthCells;
    this.H = room.heightCells;
    const n = this.W * this.H;
    this.solid = new Int16Array(n).fill(EMPTY);
    this.flat = new Int16Array(n).fill(EMPTY);
    this.doorZone = new Uint8Array(n);
    this.windowBand = new Uint8Array(n);
    this.mounts = {
      north: new Int16Array(this.W).fill(EMPTY),
      south: new Int16Array(this.W).fill(EMPTY),
      east: new Int16Array(this.H).fill(EMPTY),
      west: new Int16Array(this.H).fill(EMPTY),
    };

    const { door, window } = room;
    const zone = stripRect(room, door.wall, door.offset, door.width, Math.min(doorClearance(room), this.depthOf(door.wall)));
    this.eachCell(zone, (i) => (this.doorZone[i] = 1));
    this.eachCell(stripRect(room, door.wall, door.offset, door.width, 1), (i) => this.doorStarts.push(i));
    this.eachCell(stripRect(room, window.wall, window.offset, window.width, 1), (i) => (this.windowBand[i] = 1));
  }

  private depthOf(wall: Wall): number {
    return wall === 'north' || wall === 'south' ? this.H : this.W;
  }

  eachCell(r: { x: number; y: number; w: number; h: number }, fn: (index: number) => void): void {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) fn(y * this.W + x);
    }
  }

  inBounds(c: { x: number; y: number; w: number; h: number }): boolean {
    return c.x >= 0 && c.y >= 0 && c.x + c.w <= this.W && c.y + c.h <= this.H;
  }

  /** Walkable cells reachable from the doorway. Rugs are walkable; furniture is not. */
  reachable(): Uint8Array {
    const seen = new Uint8Array(this.W * this.H);
    const queue: number[] = [];
    for (const start of this.doorStarts) {
      if (this.solid[start] === EMPTY && !seen[start]) {
        seen[start] = 1;
        queue.push(start);
      }
    }
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head] as number;
      const x = i % this.W;
      const y = (i - x) / this.W;
      const next = [
        x > 0 ? i - 1 : -1,
        x < this.W - 1 ? i + 1 : -1,
        y > 0 ? i - this.W : -1,
        y < this.H - 1 ? i + this.W : -1,
      ];
      for (const j of next) {
        if (j >= 0 && !seen[j] && this.solid[j] === EMPTY) {
          seen[j] = 1;
          queue.push(j);
        }
      }
    }
    return seen;
  }

  /** Cells a person stands on to use the item. */
  accessCells(item: CatalogueItem, c: Candidate): number[] {
    const out: number[] = [];
    const push = (x: number, y: number) => {
      if (x >= 0 && y >= 0 && x < this.W && y < this.H) out.push(y * this.W + x);
    };
    const front = needsFrontAccess(item);
    const sides = {
      north: () => { for (let x = c.x; x < c.x + c.w; x++) push(x, c.y - 1); },
      south: () => { for (let x = c.x; x < c.x + c.w; x++) push(x, c.y + c.h); },
      west: () => { for (let y = c.y; y < c.y + c.h; y++) push(c.x - 1, y); },
      east: () => { for (let y = c.y; y < c.y + c.h; y++) push(c.x + c.w, y); },
    };
    if (front) {
      // The front is opposite the wall the item backs onto.
      sides[wallOf(((c.rot + 2) % 4) as Rotation)]();
    } else {
      sides.north();
      sides.south();
      sides.west();
      sides.east();
    }
    return out;
  }
}

/** Ordering: big anchors first, then rugs, then small pieces, then wall-mounts. */
function placementOrder(a: SolverInput, b: SolverInput): number {
  const group = (s: SolverInput) => {
    const layer = layerOf(s.item);
    if (layer === 'wall') return 3;
    if (layer === 'flat') return 1;
    return s.item.w * s.item.h >= 4 ? 0 : 2;
  };
  const placementRank = { corner: 0, wall: 1, floor: 2, wallmount: 3 } as const;
  return (
    group(a) - group(b) ||
    b.item.w * b.item.h - a.item.w * a.item.h ||
    placementRank[a.item.placement] - placementRank[b.item.placement] ||
    b.item.priority - a.item.priority ||
    a.uid.localeCompare(b.uid)
  );
}

interface Placed {
  input: SolverInput;
  c: Candidate;
}

class Attempt {
  readonly grid: Grid;
  readonly placed: (Placed | null)[];
  steps = 0;
  deepest = 0;

  constructor(
    readonly room: RoomSpec,
    readonly order: SolverInput[],
    readonly rng: () => number,
    readonly stepBudget: number,
    readonly branching: number,
    readonly failures: Map<string, number>,
    readonly candidateCache: Map<string, Candidate[]>,
  ) {
    this.grid = new Grid(room);
    this.placed = order.map(() => null);
  }

  run(): boolean {
    return this.place(0);
  }

  private place(k: number): boolean {
    if (k === this.order.length) return true;
    if (++this.steps > this.stepBudget) return false;
    this.deepest = Math.max(this.deepest, k);

    const input = this.order[k] as SolverInput;
    const ranked = this.rankedCandidates(input);
    let explored = 0;
    for (const c of ranked) {
      if (explored >= this.branching) break;
      this.apply(k, input, c, k);
      if (this.layer(input) !== 'floor' || this.everythingReachable()) {
        explored++;
        if (this.place(k + 1)) return true;
        if (this.steps > this.stepBudget) {
          this.apply(k, input, c, EMPTY);
          return false;
        }
      }
      this.apply(k, input, c, EMPTY);
    }
    if (explored === 0) {
      this.failures.set(input.uid, (this.failures.get(input.uid) ?? 0) + 1);
    }
    return false;
  }

  private layer(input: SolverInput): Layer {
    return layerOf(input.item);
  }

  /** Writes `value` (an order index, or EMPTY to clear) into the item's cells. */
  private apply(k: number, input: SolverInput, c: Candidate, value: number): void {
    const layer = this.layer(input);
    if (layer === 'wall') {
      const wall = wallOf(c.rot);
      const start = wall === 'north' || wall === 'south' ? c.x : c.y;
      const len = wall === 'north' || wall === 'south' ? c.w : c.h;
      const strip = this.grid.mounts[wall];
      for (let i = start; i < start + len; i++) strip[i] = value;
    } else {
      const target = layer === 'flat' ? this.grid.flat : this.grid.solid;
      this.grid.eachCell(c, (i) => (target[i] = value));
    }
    this.placed[k] = value === EMPTY ? null : { input, c };
  }

  private everythingReachable(): boolean {
    const seen = this.grid.reachable();
    for (const p of this.placed) {
      if (!p || layerOf(p.input.item) !== 'floor') continue;
      if (!this.grid.accessCells(p.input.item, p.c).some((i) => seen[i])) return false;
    }
    return true;
  }

  private rankedCandidates(input: SolverInput): Candidate[] {
    let all = this.candidateCache.get(input.item.id);
    if (!all) {
      all = generateCandidates(input.item, this.room);
      this.candidateCache.set(input.item.id, all);
    }
    const scored = all
      .filter((c) => this.cheapValid(input.item, c))
      .map((c) => ({ c, score: this.score(input.item, c) + this.rng() * JITTER }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.c);
  }

  /** Constraint checks that need no path finding. */
  private cheapValid(item: CatalogueItem, c: Candidate): boolean {
    const g = this.grid;
    if (!g.inBounds(c)) return false;
    const layer = layerOf(item);

    if (layer === 'wall') {
      const wall = wallOf(c.rot);
      const along = wall === 'north' || wall === 'south';
      const start = along ? c.x : c.y;
      const len = along ? c.w : c.h;
      const strip = g.mounts[wall];
      for (let i = start; i < start + len; i++) if (strip[i] !== EMPTY) return false;
      const { door, window } = this.room;
      const overlaps = (o: { wall: Wall; offset: number; width: number }) =>
        o.wall === wall && start < o.offset + o.width && o.offset < start + len;
      if (overlaps(door)) return false;
      if (!item.onWindow && overlaps(window)) return false;
      // Nothing hangs behind a wardrobe or bookshelf.
      let blocked = false;
      g.eachCell(c, (i) => {
        const owner = g.solid[i] as number;
        if (owner !== EMPTY && this.placed[owner]?.input.item.tall) blocked = true;
      });
      return !blocked;
    }

    let ok = true;
    g.eachCell(c, (i) => {
      if (!ok) return;
      if (g.doorZone[i]) ok = false;
      else if (layer === 'flat' ? g.flat[i] !== EMPTY : g.solid[i] !== EMPTY) ok = false;
      else if (item.tall && g.windowBand[i]) ok = false;
    });
    return ok;
  }

  /** Soft preferences. Higher is better. */
  private score(item: CatalogueItem, c: Candidate): number {
    const { room } = this;
    const W = room.widthCells;
    const H = room.heightCells;
    const diag = Math.hypot(W, H);
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const door = stripRect(room, room.door.wall, room.door.offset, room.door.width, 1);
    const doorDist = Math.hypot(cx - (door.x + door.w / 2), cy - (door.y + door.h / 2)) / diag;
    const hints = item.hints ?? {};
    let s = 0;

    if (hints.door === 'near') s += (1 - doorDist) * 3;
    if (hints.door === 'far') s += doorDist * 3;
    if (hints.centre) s += (1 - Math.hypot(cx - W / 2, cy - H / 2) / (diag / 2)) * 3;

    if (hints.near) {
      let best = Infinity;
      for (const p of this.placed) {
        if (!p || p.input.item.category !== hints.near) continue;
        const d = Math.hypot(cx - (p.c.x + p.c.w / 2), cy - (p.c.y + p.c.h / 2));
        best = Math.min(best, d);
      }
      if (best < Infinity) s += (1 - best / diag) * 4;
    }

    const layer = layerOf(item);
    if (layer === 'flat') {
      // A rug hidden under a bed does nothing for the room; lay it on open floor.
      let covered = 0;
      this.grid.eachCell(c, (i) => {
        if (this.grid.solid[i] !== EMPTY) covered++;
      });
      s -= (covered / (c.w * c.h)) * 6;
    }
    if (layer === 'floor' && item.placement === 'floor' && !hints.centre) {
      // Loose pieces hug the walls so the middle stays open.
      const touches = c.x === 0 || c.y === 0 || c.x + c.w === W || c.y + c.h === H;
      if (touches) s += 1.5;
    }

    if (item.category === 'media') {
      // Screens go opposite the main seat.
      for (const p of this.placed) {
        if (p && p.input.item.category === 'seating' && p.input.item.placement === 'wall') {
          if (c.rot === (p.c.rot + 2) % 4) s += 2.5;
          break;
        }
      }
    }

    if ((item.placement === 'wall' || item.placement === 'corner') && wallOf(c.rot) === room.door.wall) {
      s -= 0.5;
    }
    return s;
  }
}

/** Every position and rotation that satisfies the item's placement type, ignoring other items. */
function generateCandidates(item: CatalogueItem, room: RoomSpec): Candidate[] {
  const W = room.widthCells;
  const H = room.heightCells;
  const out: Candidate[] = [];

  if (item.placement === 'wallmount') {
    for (const rot of ROTATIONS) {
      const wall = wallOf(rot);
      if (item.onWindow) {
        if (wall !== room.window.wall) continue;
        const r = stripRect(room, wall, room.window.offset, room.window.width, 1);
        out.push({ ...r, rot });
        continue;
      }
      const len = wallLength(room, wall);
      for (let offset = 0; offset + item.w <= len; offset++) {
        out.push({ ...stripRect(room, wall, offset, item.w, 1), rot });
      }
    }
    return out;
  }

  if (item.placement === 'floor') {
    // Rugs look the same either way round, so only their footprint matters.
    const rotations: Rotation[] = !item.flat ? ROTATIONS : item.w === item.h ? [0] : [0, 1];
    for (const rot of rotations) {
      const f = footprint(item, rot);
      for (let y = 0; y + f.h <= H; y++) {
        for (let x = 0; x + f.w <= W; x++) out.push({ x, y, ...f, rot });
      }
    }
    return out;
  }

  // Wall and corner items: back flush against the wall they face away from.
  for (const rot of ROTATIONS) {
    const f = footprint(item, rot);
    const wall = wallOf(rot);
    const along = wall === 'north' || wall === 'south';
    const span = along ? W - f.w : H - f.h;
    for (let o = 0; o <= span; o++) {
      if (item.placement === 'corner' && o !== 0 && o !== span) continue;
      const x = wall === 'east' ? W - f.w : wall === 'west' ? 0 : o;
      const y = wall === 'south' ? H - f.h : wall === 'north' ? 0 : o;
      out.push({ x, y, ...f, rot });
    }
  }
  return out;
}

export function solve(items: SolverInput[], room: RoomSpec, seed: number, options: SolveOptions = {}): SolveResult {
  const attempts = options.attempts ?? 5;
  const stepBudget = options.stepBudget ?? 800;
  const branching = options.branching ?? 3;

  const roomProblem = validateRoom(room);
  if (roomProblem) return { ok: false, reason: roomProblem, dropped: items.map((i) => i.uid), seed };

  let active = [...items].sort(placementOrder);
  const dropped: string[] = [];
  const candidateCache = new Map<string, Candidate[]>();

  while (active.length > 0) {
    const failures = new Map<string, number>();
    let deepestUid: string | null = null;
    let deepest = -1;

    for (let a = 0; a < attempts; a++) {
      const rng = createRng(mixSeed(seed, dropped.length, a));
      const attempt = new Attempt(room, active, rng, stepBudget, branching, failures, candidateCache);
      if (attempt.run()) {
        const layout: PlacedItem[] = attempt.placed.map((p) => {
          const placed = p as Placed;
          return {
            uid: placed.input.uid,
            itemId: placed.input.item.id,
            ...placed.c,
            layer: layerOf(placed.input.item),
          };
        });
        return { ok: true, layout, dropped, seed };
      }
      if (attempt.deepest > deepest) {
        deepest = attempt.deepest;
        deepestUid = active[attempt.deepest]?.uid ?? null;
      }
    }

    // Drop whatever failed most; on a tie, the least important; with no clear culprit, the furthest-reached item.
    let victim: SolverInput | undefined;
    let worst = 0;
    for (const input of active) {
      const count = failures.get(input.uid) ?? 0;
      if (count > worst || (count === worst && count > 0 && victim && input.item.priority < victim.item.priority)) {
        worst = count;
        victim = input;
      }
    }
    victim ??= active.find((i) => i.uid === deepestUid) ?? active[active.length - 1];
    if (!victim) break;
    dropped.push(victim.uid);
    active = active.filter((i) => i !== victim);
  }

  return { ok: false, reason: 'Nothing on the list fits this room.', dropped, seed };
}

/**
 * Checks a finished layout against every hard rule. Returns a list of
 * problems; an empty list means the layout is valid.
 */
export function validateLayout(
  layout: PlacedItem[],
  room: RoomSpec,
  lookup: (itemId: string) => CatalogueItem,
): string[] {
  const problems: string[] = [];
  const roomProblem = validateRoom(room);
  if (roomProblem) return [roomProblem];

  const grid = new Grid(room);
  const W = room.widthCells;
  const H = room.heightCells;

  layout.forEach((p, index) => {
    const item = lookup(p.itemId);
    const f = footprint(item, p.rot);
    const label = `${item.name} (${p.uid})`;
    if (!grid.inBounds(p)) problems.push(`${label} is outside the room.`);
    if (p.layer === 'wall') {
      const wall = wallOf(p.rot);
      const along = wall === 'north' || wall === 'south';
      const start = along ? p.x : p.y;
      const len = along ? p.w : p.h;
      const strip = grid.mounts[wall];
      for (let i = start; i < start + len; i++) {
        if (strip[i] !== EMPTY) problems.push(`${label} overlaps another wall item.`);
        strip[i] = index;
      }
      const d = room.door;
      if (d.wall === wall && start < d.offset + d.width && d.offset < start + len) {
        problems.push(`${label} hangs over the door.`);
      }
      return;
    }
    if (p.w !== f.w || p.h !== f.h) problems.push(`${label} has the wrong footprint.`);
    if (item.placement === 'wall' || item.placement === 'corner') {
      const wall = wallOf(p.rot);
      const flush =
        (wall === 'north' && p.y === 0) ||
        (wall === 'south' && p.y + p.h === H) ||
        (wall === 'west' && p.x === 0) ||
        (wall === 'east' && p.x + p.w === W);
      if (!flush) problems.push(`${label} is not against a wall.`);
      if (item.placement === 'corner') {
        const corner = wall === 'north' || wall === 'south' ? p.x === 0 || p.x + p.w === W : p.y === 0 || p.y + p.h === H;
        if (!corner) problems.push(`${label} is not in a corner.`);
      }
    }
    const target = p.layer === 'flat' ? grid.flat : grid.solid;
    grid.eachCell(p, (i) => {
      if (grid.doorZone[i]) problems.push(`${label} blocks the door.`);
      if (target[i] !== EMPTY) problems.push(`${label} overlaps another item.`);
      if (item.tall && grid.windowBand[i]) problems.push(`${label} blocks the window.`);
      target[i] = index;
    });
  });

  const seen = grid.reachable();
  for (const p of layout) {
    if (p.layer !== 'floor') continue;
    const item = lookup(p.itemId);
    if (!grid.accessCells(item, p).some((i) => seen[i])) {
      problems.push(`${item.name} (${p.uid}) can't be reached from the door.`);
    }
  }
  return [...new Set(problems)];
}

/** Floor cells a layout can use: the whole room minus the door's clearance zone. */
export function usableCells(room: RoomSpec): number {
  const grid = new Grid(room);
  return grid.W * grid.H - grid.doorZone.reduce((sum, cell) => sum + cell, 0);
}

/**
 * Share of usable floor (0–1) covered by furniture or rugs. Each cell counts
 * once, so a table standing on a rug isn't counted twice.
 */
export function floorCoverage(layout: PlacedItem[], room: RoomSpec): number {
  const grid = new Grid(room);
  const covered = new Uint8Array(grid.W * grid.H);
  for (const p of layout) {
    if (p.layer === 'wall') continue;
    grid.eachCell(p, (i) => {
      if (!grid.doorZone[i]) covered[i] = 1;
    });
  }
  const usable = usableCells(room);
  return usable > 0 ? covered.reduce((sum, cell) => sum + cell, 0) / usable : 0;
}

/** Share of items (0–1) that moved, turned, appeared or disappeared between two layouts. */
export function layoutDistance(a: PlacedItem[], b: PlacedItem[]): number {
  const byUid = new Map(b.map((p) => [p.uid, p]));
  const uids = new Set([...a.map((p) => p.uid), ...b.map((p) => p.uid)]);
  if (uids.size === 0) return 0;
  let changed = 0;
  for (const p of a) {
    const q = byUid.get(p.uid);
    if (!q || q.x !== p.x || q.y !== p.y || q.rot !== p.rot) changed++;
  }
  changed += [...uids].filter((uid) => !a.some((p) => p.uid === uid)).length;
  return changed / uids.size;
}
