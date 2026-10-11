import type { CatalogueItem, Opening, PlacedItem, Room, Rotation, Wall } from '../adapter/types';
import { hintsFor, isFlat, isTall, isWindowDressing, needsFrontAccess, roleOf } from './traits';

/**
 * Grid placement with hard constraints, for one room.
 *
 * Rules every layout obeys:
 *  - wall items have their back flush to a wall and face into the room;
 *    corner items touch two walls
 *  - nothing stands in any door's clearance zone; wall-mounts never cover a door
 *  - tall items never stand directly in front of a window
 *  - solid items never overlap each other; flat items (rugs) never overlap each other
 *  - every door stays connected to every other door, and every solid item can
 *    be reached on foot from the doors
 *
 * Search is greedy best-first with depth-first backtracking under a step
 * budget. A seeded RNG jitters candidate scores, so a new seed gives a
 * different layout that still satisfies every rule. When an item keeps
 * failing after several attempts it is dropped (bought pieces before owned
 * ones) and the rest are solved again.
 *
 * No React, no DOM, no globals: same inputs, same output.
 */

export interface SolverInput {
  uid: string;
  item: CatalogueItem;
  /** Prefer keeping this piece if something has to go (it's already owned). */
  keep?: boolean;
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

/** Quarter turns, internally. 0 = back to the north wall. */
type Turn = 0 | 1 | 2 | 3;

const WALLS: Wall[] = ['north', 'east', 'south', 'west'];
const TURNS: Turn[] = [0, 1, 2, 3];
const JITTER = 4;
const EMPTY = -1;

function wallOf(turn: Turn): Wall {
  return WALLS[turn] as Wall;
}

function toRotation(turn: Turn): Rotation {
  return (turn * 90) as Rotation;
}

function toTurn(rotation: Rotation): Turn {
  return ((((rotation / 90) % 4) + 4) % 4) as Turn;
}

/** Footprint of an item once turned. */
function footprint(item: Pick<CatalogueItem, 'w' | 'h'>, turn: Turn): { w: number; h: number } {
  return turn % 2 === 0 ? { w: item.w, h: item.h } : { w: item.h, h: item.w };
}

export function wallLength(room: Room, wall: Wall): number {
  return wall === 'north' || wall === 'south' ? room.widthCells : room.heightCells;
}

/** Depth of the clear zone kept in front of a door. */
export function doorClearance(door: Opening): number {
  return Math.max(1, door.width);
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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cells covered by a strip of `depth` cells running along `wall` from `offset`. */
function stripRect(room: Room, wall: Wall, offset: number, length: number, depth: number): Rect {
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

function spansOverlap(a: Opening, b: Opening): boolean {
  return a.wall === b.wall && a.offset < b.offset + b.width && b.offset < a.offset + a.width;
}

export function validateRoom(room: Room): string | null {
  const { widthCells: W, heightCells: H } = room;
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < 3 || H < 3) {
    return 'This room is too small to furnish.';
  }
  if (room.doors.length === 0) return 'This room has no door, so nothing could be carried in.';
  const openings = [...room.doors.map((o) => ['door', o] as const), ...room.windows.map((o) => ['window', o] as const)];
  for (const [label, opening] of openings) {
    const len = wallLength(room, opening.wall);
    if (opening.width < 1 || opening.offset < 0 || opening.offset + opening.width > len) {
      return `One of this room's ${label}s sits outside its wall.`;
    }
  }
  for (let i = 0; i < openings.length; i++) {
    for (let j = i + 1; j < openings.length; j++) {
      if (spansOverlap((openings[i] as (typeof openings)[number])[1], (openings[j] as (typeof openings)[number])[1])) {
        return 'Two of this room’s doors or windows overlap.';
      }
    }
  }
  return null;
}

interface Candidate extends Rect {
  turn: Turn;
}

type Layer = PlacedItem['layer'];

function layerOf(item: CatalogueItem): Layer {
  if (item.placement === 'wallmount') return 'wall';
  return isFlat(item) ? 'flat' : 'floor';
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
  /** For each door, the cells just inside it. */
  readonly doorStarts: number[][];

  constructor(readonly room: Room) {
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
    this.doorStarts = room.doors.map((door) => {
      const depth = Math.min(doorClearance(door), door.wall === 'north' || door.wall === 'south' ? this.H : this.W);
      this.eachCell(stripRect(room, door.wall, door.offset, door.width, depth), (i) => (this.doorZone[i] = 1));
      const starts: number[] = [];
      this.eachCell(stripRect(room, door.wall, door.offset, door.width, 1), (i) => starts.push(i));
      return starts;
    });
    for (const window of room.windows) {
      this.eachCell(stripRect(room, window.wall, window.offset, window.width, 1), (i) => (this.windowBand[i] = 1));
    }
  }

  eachCell(r: Rect, fn: (index: number) => void): void {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) fn(y * this.W + x);
    }
  }

  inBounds(c: Rect): boolean {
    return c.x >= 0 && c.y >= 0 && c.x + c.w <= this.W && c.y + c.h <= this.H;
  }

  /**
   * Walkable cells reachable from the first door, or null when some other
   * door has been cut off from it. Rugs are walkable; furniture is not.
   */
  reachable(): Uint8Array | null {
    const seen = new Uint8Array(this.W * this.H);
    const queue: number[] = [];
    for (const start of this.doorStarts[0] ?? []) {
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
    for (const starts of this.doorStarts) {
      if (!starts.some((i) => seen[i])) return null;
    }
    return seen;
  }

  /** Cells a person stands on to use the item. */
  accessCells(item: CatalogueItem, c: Candidate): number[] {
    const out: number[] = [];
    const push = (x: number, y: number) => {
      if (x >= 0 && y >= 0 && x < this.W && y < this.H) out.push(y * this.W + x);
    };
    const sides: Record<Wall, () => void> = {
      north: () => { for (let x = c.x; x < c.x + c.w; x++) push(x, c.y - 1); },
      south: () => { for (let x = c.x; x < c.x + c.w; x++) push(x, c.y + c.h); },
      west: () => { for (let y = c.y; y < c.y + c.h; y++) push(c.x - 1, y); },
      east: () => { for (let y = c.y; y < c.y + c.h; y++) push(c.x + c.w, y); },
    };
    if (needsFrontAccess(item)) {
      // The front is opposite the wall the item backs onto.
      sides[wallOf(((c.turn + 2) % 4) as Turn)]();
    } else {
      for (const wall of WALLS) sides[wall]();
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
  const placementRank = { corner: 0, wall: 1, floor: 2, yard: 2, wallmount: 3 } as const;
  return (
    group(a) - group(b) ||
    b.item.w * b.item.h - a.item.w * a.item.h ||
    placementRank[a.item.placement] - placementRank[b.item.placement] ||
    Number(!!b.keep) - Number(!!a.keep) ||
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
  readonly doorCentres: { x: number; y: number }[];
  steps = 0;
  deepest = 0;

  constructor(
    readonly room: Room,
    readonly order: SolverInput[],
    readonly rng: () => number,
    readonly stepBudget: number,
    readonly branching: number,
    readonly failures: Map<string, number>,
    readonly candidateCache: Map<string, Candidate[]>,
  ) {
    this.grid = new Grid(room);
    this.placed = order.map(() => null);
    this.doorCentres = room.doors.map((d) => {
      const r = stripRect(room, d.wall, d.offset, d.width, 1);
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    });
  }

  run(): boolean {
    return this.place(0);
  }

  private place(k: number): boolean {
    if (k === this.order.length) return true;
    if (++this.steps > this.stepBudget) return false;
    this.deepest = Math.max(this.deepest, k);

    const input = this.order[k] as SolverInput;
    let explored = 0;
    for (const c of this.rankedCandidates(input)) {
      if (explored >= this.branching) break;
      this.apply(k, input, c, k);
      if (layerOf(input.item) !== 'floor' || this.everythingReachable()) {
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

  /** Writes `value` (an order index, or EMPTY to clear) into the item's cells. */
  private apply(k: number, input: SolverInput, c: Candidate, value: number): void {
    const layer = layerOf(input.item);
    if (layer === 'wall') {
      const wall = wallOf(c.turn);
      const along = wall === 'north' || wall === 'south';
      const start = along ? c.x : c.y;
      const len = along ? c.w : c.h;
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
    if (!seen) return false;
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
      const wall = wallOf(c.turn);
      const along = wall === 'north' || wall === 'south';
      const start = along ? c.x : c.y;
      const len = along ? c.w : c.h;
      const strip = g.mounts[wall];
      for (let i = start; i < start + len; i++) if (strip[i] !== EMPTY) return false;
      const span: Opening = { wall, offset: start, width: len };
      if (this.room.doors.some((d) => spansOverlap(d, span))) return false;
      if (!isWindowDressing(item) && this.room.windows.some((w) => spansOverlap(w, span))) return false;
      // Nothing hangs behind a wardrobe or bookshelf.
      let blocked = false;
      g.eachCell(c, (i) => {
        const owner = g.solid[i] as number;
        const occupant = owner !== EMPTY ? this.placed[owner] : null;
        if (occupant && isTall(occupant.input.item)) blocked = true;
      });
      return !blocked;
    }

    const tall = isTall(item);
    let ok = true;
    g.eachCell(c, (i) => {
      if (!ok) return;
      if (g.doorZone[i]) ok = false;
      else if (layer === 'flat' ? g.flat[i] !== EMPTY : g.solid[i] !== EMPTY) ok = false;
      else if (tall && g.windowBand[i]) ok = false;
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
    const doorDist =
      Math.min(...this.doorCentres.map((d) => Math.hypot(cx - d.x, cy - d.y))) / diag;
    const hints = hintsFor(item, room);
    let s = 0;

    if (hints.door === 'near') s += (1 - doorDist) * 3;
    if (hints.door === 'far') s += doorDist * 3;
    if (hints.centre) s += (1 - Math.hypot(cx - W / 2, cy - H / 2) / (diag / 2)) * 3;

    if (hints.near) {
      let best = Infinity;
      for (const p of this.placed) {
        if (!p || roleOf(p.input.item) !== hints.near) continue;
        best = Math.min(best, Math.hypot(cx - (p.c.x + p.c.w / 2), cy - (p.c.y + p.c.h / 2)));
      }
      if (best < Infinity) s += (1 - best / diag) * 4;
    }

    if (hints.facesSeat) {
      // Screens go opposite the main seat.
      const seat = this.placed.find((p) => p && roleOf(p.input.item) === 'seat' && p.input.item.placement === 'wall');
      if (seat && c.turn === (seat.c.turn + 2) % 4) s += 2.5;
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
    if (layer === 'floor' && (item.placement === 'floor' || item.placement === 'yard') && !hints.centre) {
      // Loose pieces hug the walls so the middle stays open.
      const touches = c.x === 0 || c.y === 0 || c.x + c.w === W || c.y + c.h === H;
      if (touches) s += 1.5;
    }
    if ((item.placement === 'wall' || item.placement === 'corner') && room.doors.some((d) => d.wall === wallOf(c.turn))) {
      s -= 0.5;
    }
    return s;
  }
}

/** Every position and turn that satisfies the item's placement type, ignoring other items. */
function generateCandidates(item: CatalogueItem, room: Room): Candidate[] {
  const W = room.widthCells;
  const H = room.heightCells;
  const turns: Turn[] = item.rotatable ? TURNS : [0];
  const out: Candidate[] = [];

  if (item.placement === 'wallmount') {
    if (isWindowDressing(item)) {
      for (const window of room.windows) {
        const turn = WALLS.indexOf(window.wall) as Turn;
        if (!turns.includes(turn)) continue;
        out.push({ ...stripRect(room, window.wall, window.offset, window.width, 1), turn });
      }
      return out;
    }
    for (const turn of turns) {
      const wall = wallOf(turn);
      const len = wallLength(room, wall);
      for (let offset = 0; offset + item.w <= len; offset++) {
        out.push({ ...stripRect(room, wall, offset, item.w, 1), turn });
      }
    }
    return out;
  }

  if (item.placement === 'floor' || item.placement === 'yard') {
    // Rugs look the same either way round, so only their footprint matters.
    const options: Turn[] = isFlat(item) ? (item.w === item.h ? [0] : turns.filter((t) => t < 2)) : turns;
    for (const turn of options) {
      const f = footprint(item, turn);
      for (let y = 0; y + f.h <= H; y++) {
        for (let x = 0; x + f.w <= W; x++) out.push({ x, y, ...f, turn });
      }
    }
    return out;
  }

  // Wall and corner items: back flush against the wall, facing into the room.
  for (const turn of turns) {
    const f = footprint(item, turn);
    const wall = wallOf(turn);
    const along = wall === 'north' || wall === 'south';
    const span = along ? W - f.w : H - f.h;
    for (let o = 0; o <= span; o++) {
      if (item.placement === 'corner' && o !== 0 && o !== span) continue;
      const x = wall === 'east' ? W - f.w : wall === 'west' ? 0 : o;
      const y = wall === 'south' ? H - f.h : wall === 'north' ? 0 : o;
      out.push({ x, y, ...f, turn });
    }
  }
  return out;
}

export function solve(items: SolverInput[], room: Room, seed: number, options: SolveOptions = {}): SolveResult {
  const attempts = options.attempts ?? 4;
  const stepBudget = options.stepBudget ?? 600;
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
          const { input, c } = p as Placed;
          return {
            uid: input.uid,
            itemId: input.item.id,
            x: c.x,
            y: c.y,
            w: c.w,
            h: c.h,
            rotation: toRotation(c.turn),
            layer: layerOf(input.item),
          };
        });
        return { ok: true, layout, dropped, seed };
      }
      if (attempt.deepest > deepest) {
        deepest = attempt.deepest;
        deepestUid = active[attempt.deepest]?.uid ?? null;
      }
    }

    // Drop whatever failed most. Ties go against bought pieces before owned
    // ones, then the bigger piece. With no clear culprit, the furthest-reached item.
    let victim: SolverInput | undefined;
    let worst = 0;
    const weaker = (a: SolverInput, b: SolverInput) =>
      Number(!!a.keep) - Number(!!b.keep) || b.item.w * b.item.h - a.item.w * a.item.h;
    for (const input of active) {
      const count = failures.get(input.uid) ?? 0;
      if (count > worst || (count === worst && count > 0 && victim && weaker(input, victim) < 0)) {
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
  room: Room,
  lookup: (itemId: string) => CatalogueItem | undefined,
): string[] {
  const roomProblem = validateRoom(room);
  if (roomProblem) return [roomProblem];
  const problems: string[] = [];
  const grid = new Grid(room);
  const W = room.widthCells;
  const H = room.heightCells;
  const turns: Turn[] = [];

  layout.forEach((p, index) => {
    const item = lookup(p.itemId);
    const turn = toTurn(p.rotation);
    turns.push(turn);
    if (!item) {
      problems.push(`${p.uid} is not in the catalogue.`);
      return;
    }
    const label = `${item.name} (${p.uid})`;
    if (![0, 90, 180, 270].includes(p.rotation)) problems.push(`${label} has an invalid rotation.`);
    if (!item.rotatable && p.rotation !== 0) problems.push(`${label} can't be rotated.`);
    if (!grid.inBounds(p)) problems.push(`${label} is outside the room.`);
    if (p.layer === 'wall') {
      const wall = wallOf(turn);
      const along = wall === 'north' || wall === 'south';
      const start = along ? p.x : p.y;
      const len = along ? p.w : p.h;
      const strip = grid.mounts[wall];
      for (let i = start; i < start + len; i++) {
        if (strip[i] !== EMPTY) problems.push(`${label} overlaps another wall item.`);
        strip[i] = index;
      }
      const span: Opening = { wall, offset: start, width: len };
      if (room.doors.some((d) => spansOverlap(d, span))) problems.push(`${label} hangs over a door.`);
      if (isWindowDressing(item)) {
        if (!room.windows.some((w) => w.wall === wall && w.offset === start && w.width === len)) {
          problems.push(`${label} doesn't hang over a window.`);
        }
      } else if (room.windows.some((w) => spansOverlap(w, span))) {
        problems.push(`${label} covers a window.`);
      }
      return;
    }
    const f = footprint(item, turn);
    if (p.w !== f.w || p.h !== f.h) problems.push(`${label} has the wrong footprint.`);
    if (item.placement === 'wall' || item.placement === 'corner') {
      const wall = wallOf(turn);
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
      if (grid.doorZone[i]) problems.push(`${label} blocks a door.`);
      if (target[i] !== EMPTY) problems.push(`${label} overlaps another item.`);
      if (isTall(item) && grid.windowBand[i]) problems.push(`${label} blocks a window.`);
      target[i] = index;
    });
  });

  // Nothing tall in front of a wall-mount.
  layout.forEach((p) => {
    if (p.layer !== 'wall') return;
    grid.eachCell(p, (i) => {
      const owner = grid.solid[i] as number;
      const under = owner !== EMPTY ? layout[owner] : undefined;
      const item = under ? lookup(under.itemId) : undefined;
      if (item && isTall(item)) problems.push(`${p.uid} hangs behind ${item.name}.`);
    });
  });

  const seen = grid.reachable();
  if (!seen) {
    problems.push('Furniture cuts one door off from another.');
  } else {
    layout.forEach((p, index) => {
      if (p.layer !== 'floor') return;
      const item = lookup(p.itemId);
      if (item && !grid.accessCells(item, { ...p, turn: turns[index] as Turn }).some((i) => seen[i])) {
        problems.push(`${item.name} (${p.uid}) can't be reached from the door.`);
      }
    });
  }
  return [...new Set(problems)];
}

/** Floor cells a layout can use: the whole room minus the doors' clearance zones. */
export function usableCells(room: Room): number {
  const grid = new Grid(room);
  return grid.W * grid.H - grid.doorZone.reduce((sum, cell) => sum + cell, 0);
}

/**
 * Share of usable floor (0–1) covered by furniture or rugs. Each cell counts
 * once, so a table standing on a rug isn't counted twice.
 */
export function floorCoverage(layout: PlacedItem[], room: Room): number {
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
    if (!q || q.x !== p.x || q.y !== p.y || q.rotation !== p.rotation) changed++;
  }
  const inA = new Set(a.map((p) => p.uid));
  changed += [...uids].filter((uid) => !inA.has(uid)).length;
  return changed / uids.size;
}

/** Which way an item faces, for instructions. */
export function facing(rotation: Rotation): Wall {
  // Rotation 0 backs onto the north wall, so it faces south.
  return wallOf(((toTurn(rotation) + 2) % 4) as Turn);
}
