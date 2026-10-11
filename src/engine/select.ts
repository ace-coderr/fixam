import type { CatalogueItem, Room, StoredItem } from '../adapter/types';
import type { Pricing } from './pricing';
import { usableCells } from './solver';
import {
  COVERAGE_BANDS,
  MUST_HAVES,
  fitsRoomType,
  isFinish,
  isFlat,
  isSupporting,
  isTraitTag,
  isWindowDressing,
  itemCap,
  roleCap,
  roleOf,
  rolePriority,
  type Role,
} from './traits';
import type { TagWeights } from './vibes';

/**
 * Chooses what goes into one room, all at displayed prices:
 *
 *  0. Storage: anything the player already owns that suits the room and the
 *     style goes in first, at ₦0.
 *  1. Must-haves for the room type (a bed for a bedroom, a toilet for a bath).
 *  2. Floor and wall paint that match the vibe.
 *  3. Nice-to-haves, best vibe match first.
 *  4. Density: supporting pieces until the floor is covered for the room type.
 *  5. Finishing touches on the walls.
 *
 * Every pass holds money back for the passes after it, so one big-ticket pick
 * can never leave the room half empty. The total never exceeds the budget.
 */

/** Share of the room solid furniture may cover, leaving room to walk. */
const SOLID_FLOOR_SHARE = 0.38;
/** Share of the wall length wall-mounted items may use. */
const WALL_SHARE = 0.45;
/** Below this vibe match, an item is off-style. */
const MIN_NICE_MATCH = 0.9;
/** Storage pieces below this match clash with the style and are suggested for sale instead. */
const STORAGE_MIN_MATCH = 0.75;
/** Wall pieces the finishing pass may add. */
const FINISHING_WALL_PIECES = 3;
/** Keep the current finish unless the best match beats it by this much. */
const FINISH_SWITCH_MARGIN = 1.1;
const REPEAT_DECAY = 0.6;
const STORAGE_BONUS = 1.5;

export interface Pick {
  uid: string;
  item: CatalogueItem;
  /** What the player pays, at displayed prices. ₦0 for something from storage. */
  cost: number;
  /** True when it comes from the player's storage. */
  owned: boolean;
  source: 'storage' | 'buy';
  /** The storage entry it comes from, when owned. */
  storedUid?: string;
  mustHave: boolean;
  score: number;
}

export interface SellSuggestion {
  storedUid: string;
  item: CatalogueItem;
  /** What the game pays back: 60% of the displayed list price. */
  value: number;
}

export interface Selection {
  /** Pieces to place on the grid. */
  picks: Pick[];
  /** Floor and paint, when the plan changes them. */
  finishes: { floor: Pick | null; wallPaint: Pick | null };
  total: number;
  left: number;
  budget: number;
  /** Must-have roles nothing affordable could fill. */
  missing: Role[];
  /** The least the must-haves could cost this player. */
  minimumForBasics: number;
  /** Footprint of the floor pieces as a share of usable floor, before placement. */
  plannedCoverage: number;
  sellSuggestions: SellSuggestion[];
}

export interface SelectInput {
  catalogue: CatalogueItem[];
  room: Room;
  weights: TagWeights;
  /** Money for furniture and finishes, after Fixam's fee. */
  budget: number;
  pricing: Pricing;
  storage: StoredItem[];
  /** Share of usable floor to fill by footprint. Defaults to the middle of the room type's band. */
  coverageTarget?: number;
  /**
   * Extra footprint, in cells, to allow for rugs that end up partly under
   * furniture once placed. Raises both the target and the ceiling.
   */
  overlapAllowance?: number;
}

/** How well an item matches the weights. 1 is neutral. */
export function tagMatch(item: CatalogueItem, weights: TagWeights): number {
  const style = item.tags.filter((t) => !isTraitTag(t));
  const sum = style.reduce((acc, tag) => acc + (weights[tag] ?? 0), 0);
  return Math.max(0.1, 1 + sum / Math.sqrt(Math.max(1, style.length)));
}

/** Luxe vibes lean towards high-star pieces, thrifty ones away from them. */
function starFactor(item: CatalogueItem, weights: TagWeights): number {
  const appetite = (weights.luxe ?? 0) + 0.5 * (weights.glam ?? 0) - (weights.budget ?? 0) - 0.5 * (weights.starter ?? 0);
  return Math.min(2.5, Math.max(0.3, 1 + 0.12 * appetite * (item.stars - 1.5)));
}

/** Overall appeal of an item for this vibe, before priority. */
export function styleScore(item: CatalogueItem, weights: TagWeights): number {
  return tagMatch(item, weights) * starFactor(item, weights);
}

function fitsFootprint(item: CatalogueItem, room: Room): boolean {
  if (item.placement === 'wallmount') return true;
  const long = Math.max(item.w, item.h);
  const short = Math.min(item.w, item.h);
  return long <= Math.max(room.widthCells, room.heightCells) && short <= Math.min(room.widthCells, room.heightCells);
}

/** True when the item can go in this room at all: right room type, fits, and placeable. */
export function belongsIn(item: CatalogueItem, room: Room): boolean {
  if (isFinish(item)) return false;
  if (!fitsRoomType(item, room.type)) return false;
  if (item.placement === 'yard' && room.type !== 'yard') return false;
  if (isWindowDressing(item) && room.windows.length === 0) return false;
  return fitsFootprint(item, room);
}

/** Floor cells an item takes up. Wall-mounted pieces take none. */
function floorArea(item: CatalogueItem): number {
  return item.placement === 'wallmount' ? 0 : item.w * item.h;
}

/** Corners the doorways' clearance zones run into. */
function doorCorners(room: Room): number {
  const corners = new Set<string>();
  for (const door of room.doors) {
    const length = door.wall === 'north' || door.wall === 'south' ? room.widthCells : room.heightCells;
    if (door.offset === 0) corners.add(`${door.wall}:start`);
    if (door.offset + door.width === length) corners.add(`${door.wall}:end`);
  }
  // Each corner is shared by two walls; count distinct physical corners.
  const physical = new Set<string>();
  for (const key of corners) {
    const [wall, end] = key.split(':');
    const corner =
      wall === 'north' ? (end === 'start' ? 'nw' : 'ne')
      : wall === 'south' ? (end === 'start' ? 'sw' : 'se')
      : wall === 'west' ? (end === 'start' ? 'nw' : 'sw')
      : end === 'start' ? 'ne' : 'se';
    physical.add(corner);
  }
  return physical.size;
}

/** The same supporting pieces in different orders, for estimating reachable floor. */
type FillerOrders = CatalogueItem[][];

interface Limits {
  solidCap: number;
  floorCap: number;
  wallCap: number;
  cornerCap: number;
  targetCells: number;
  usable: number;
}

/** The running shopping list. Cheap to copy, so passes can try a pick before committing. */
class Basket {
  picks: Pick[] = [];
  countById = new Map<string, number>();
  countByRole = new Map<Role, number>();
  remaining: number;
  solidUsed = 0;
  floorUsed = 0;
  wallUsed = 0;
  cornersUsed = 0;

  constructor(
    readonly room: Room,
    readonly weights: TagWeights,
    readonly pricing: Pricing,
    readonly limits: Limits,
    budget: number,
  ) {
    this.remaining = budget;
  }

  clone(): Basket {
    const copy = new Basket(this.room, this.weights, this.pricing, this.limits, this.remaining);
    copy.picks = [...this.picks];
    copy.countById = new Map(this.countById);
    copy.countByRole = new Map(this.countByRole);
    copy.solidUsed = this.solidUsed;
    copy.floorUsed = this.floorUsed;
    copy.wallUsed = this.wallUsed;
    copy.cornersUsed = this.cornersUsed;
    return copy;
  }

  score(item: CatalogueItem, fromStorage = false): number {
    const copies = this.countById.get(item.id) ?? 0;
    return (
      styleScore(item, this.weights) *
      rolePriority(roleOf(item), this.room.type) *
      Math.pow(REPEAT_DECAY, copies) *
      (fromStorage ? STORAGE_BONUS : 1)
    );
  }

  canHold(item: CatalogueItem): boolean {
    const { limits, room } = this;
    const role = roleOf(item);
    if ((this.countById.get(item.id) ?? 0) >= itemCap(item, room, limits.usable)) return false;
    if ((this.countByRole.get(role) ?? 0) >= roleCap(role, room, limits.usable)) return false;
    if (item.placement === 'wallmount') return isWindowDressing(item) || this.wallUsed + item.w <= limits.wallCap;
    if (item.placement === 'corner' && this.cornersUsed >= limits.cornerCap) return false;
    const area = floorArea(item);
    if (this.floorUsed + area > limits.floorCap) return false;
    return isFlat(item) || this.solidUsed + area <= limits.solidCap;
  }

  take(item: CatalogueItem, options: { mustHave?: boolean; storedUid?: string } = {}): void {
    const owned = options.storedUid !== undefined;
    const cost = owned ? 0 : this.pricing.price(item);
    const copies = this.countById.get(item.id) ?? 0;
    const role = roleOf(item);
    this.picks.push({
      uid: owned ? (options.storedUid as string) : `${item.id}:${copies + 1}`,
      item,
      cost,
      owned,
      source: owned ? 'storage' : 'buy',
      storedUid: options.storedUid,
      mustHave: options.mustHave ?? false,
      score: this.score(item, owned),
    });
    this.countById.set(item.id, copies + 1);
    this.countByRole.set(role, (this.countByRole.get(role) ?? 0) + 1);
    this.remaining -= cost;
    if (item.placement === 'wallmount') {
      if (!isWindowDressing(item)) this.wallUsed += item.w;
      return;
    }
    this.floorUsed += floorArea(item);
    if (!isFlat(item)) this.solidUsed += floorArea(item);
    if (item.placement === 'corner') this.cornersUsed += 1;
  }

  with(item: CatalogueItem): Basket {
    const next = this.clone();
    next.take(item);
    return next;
  }

  /**
   * How much floor could be covered, up to the target, by spending `money` on
   * supporting pieces. Tries each filler ordering and keeps the best: cheapest
   * per cell usually wins, but when a role has few slots left (only so many
   * rugs fit a room), bigger pieces first goes further.
   */
  reachableFloor(orders: FillerOrders, money: number): number {
    const target = this.limits.targetCells;
    if (this.floorUsed >= target) return target;
    let best = this.floorUsed;
    for (const fillers of orders) {
      const sim = this.clone();
      let left = money;
      for (const item of fillers) {
        const price = this.pricing.price(item);
        while (sim.floorUsed < target && price <= left && sim.canHold(item)) {
          left -= price;
          sim.take(item);
        }
      }
      best = Math.max(best, sim.floorUsed);
      if (best >= target) break;
    }
    return Math.min(best, target);
  }

  reachableAfter(item: CatalogueItem, fillers: FillerOrders, holdBack = 0): number {
    return this.with(item).reachableFloor(fillers, this.remaining - this.pricing.price(item) - holdBack);
  }
}

export function select(input: SelectInput): Selection {
  const { room, weights, pricing } = input;
  const budget = Math.max(0, Math.floor(input.budget));
  const byId = new Map(input.catalogue.map((item) => [item.id, item]));
  const pool = input.catalogue.filter((item) => belongsIn(item, room));

  const usable = usableCells(room);
  const band = COVERAGE_BANDS[room.type];
  const target = Math.min(input.coverageTarget ?? (band.low + band.high) / 2, band.high);
  const perimeter = 2 * (room.widthCells + room.heightCells);
  const openings = [...room.doors, ...room.windows].reduce((sum, o) => sum + o.width, 0);
  const allowance = Math.max(0, Math.round(input.overlapAllowance ?? 0));
  const limits: Limits = {
    solidCap: Math.floor(room.widthCells * room.heightCells * SOLID_FLOOR_SHARE),
    floorCap: Math.floor(usable * band.high) + allowance,
    wallCap: Math.max(0, Math.floor((perimeter - openings) * WALL_SHARE)),
    cornerCap: 4 - doorCorners(room),
    targetCells: Math.ceil(usable * target) + allowance,
    usable,
  };
  const basket = new Basket(room, weights, pricing, limits, budget);

  const fillers = pool
    .filter((item) => isSupporting(item) && floorArea(item) > 0)
    .sort((a, b) => pricing.price(a) / floorArea(a) - pricing.price(b) / floorArea(b));
  const fillerOrders: FillerOrders = [
    fillers,
    [...fillers].sort((a, b) => floorArea(b) - floorArea(a) || pricing.price(a) / floorArea(a) - pricing.price(b) / floorArea(b)),
  ];

  const better = (a: CatalogueItem, b: CatalogueItem) => {
    const diff = basket.score(b) - basket.score(a);
    return diff !== 0 ? diff : pricing.price(a) - pricing.price(b);
  };

  // Pass 0: storage. Owned pieces that suit this room and style go in first, at ₦0.
  const stored = input.storage
    .map((entry) => ({ entry, item: byId.get(entry.itemId) }))
    .filter((s): s is { entry: StoredItem; item: CatalogueItem } => !!s.item && !isFinish(s.item));
  const sellSuggestions: SellSuggestion[] = stored
    .filter((s) => tagMatch(s.item, weights) < STORAGE_MIN_MATCH)
    .map((s) => ({ storedUid: s.entry.uid, item: s.item, value: pricing.resale(s.item) }));
  const usefulStorage = stored
    .filter((s) => belongsIn(s.item, room) && tagMatch(s.item, weights) >= STORAGE_MIN_MATCH)
    .sort((a, b) => {
      const mustA = Number(MUST_HAVES[room.type].includes(roleOf(a.item)));
      const mustB = Number(MUST_HAVES[room.type].includes(roleOf(b.item)));
      return mustB - mustA || basket.score(b.item, true) - basket.score(a.item, true);
    });
  // Floor the cheapest piece for each unfilled must-have would need, so owned
  // pieces never crowd out the essentials.
  const mustHaveArea = (role: Role) => {
    const cheapest = pool
      .filter((item) => roleOf(item) === role)
      .sort((a, b) => pricing.price(a) - pricing.price(b) || floorArea(a) - floorArea(b))[0];
    return cheapest ? floorArea(cheapest) : 0;
  };
  const usedStorage = new Set<string>();
  const sweepStorage = () => {
    for (const { entry, item } of usefulStorage) {
      if (usedStorage.has(entry.uid) || !basket.canHold(item)) continue;
      const role = roleOf(item);
      const reserve = MUST_HAVES[room.type]
        .filter((r) => r !== role && !basket.countByRole.get(r))
        .reduce((sum, r) => sum + mustHaveArea(r), 0);
      const area = floorArea(item);
      if (area > 0 && basket.floorUsed + area + reserve > limits.floorCap) continue;
      if (area > 0 && !isFlat(item) && basket.solidUsed + area + reserve > limits.solidCap) continue;
      basket.take(item, { storedUid: entry.uid, mustHave: MUST_HAVES[room.type].includes(role) });
      usedStorage.add(entry.uid);
    }
  };
  sweepStorage();

  // Pass 1: must-haves not already covered from storage.
  const mustHaves = MUST_HAVES[room.type].filter((role) => !basket.countByRole.get(role));
  const cheapestFor = (role: Role) => {
    const prices = pool.filter((item) => roleOf(item) === role).map((item) => pricing.price(item));
    return prices.length ? Math.min(...prices) : Infinity;
  };
  const minimumForBasics = MUST_HAVES[room.type]
    .filter((role) => !usefulStorage.some((s) => roleOf(s.item) === role))
    .reduce((sum, role) => sum + cheapestFor(role), 0);

  const missing: Role[] = [];
  mustHaves.forEach((role, index) => {
    const later = mustHaves.slice(index + 1).reduce((sum, r) => sum + cheapestFor(r), 0);
    const options = pool.filter(
      (item) => roleOf(item) === role && basket.canHold(item) && pricing.price(item) <= basket.remaining,
    );
    const keepsBasics = options.filter((item) => pricing.price(item) <= basket.remaining - later);
    const candidates = keepsBasics.length ? keepsBasics : options;
    // Best match that can still reach the coverage target; failing that, whichever gets closest.
    const reach = new Map(candidates.map((item) => [item, basket.reachableAfter(item, fillerOrders, later)]));
    const furthest = Math.max(0, ...reach.values());
    const choice = candidates
      .filter((item) => reach.get(item) === furthest || (reach.get(item) ?? 0) >= limits.targetCells)
      .sort(better)[0];
    if (choice) basket.take(choice, { mustHave: true });
    else missing.push(role);
  });

  // With the essentials in, any owned piece that now fits goes in before anything else is bought.
  sweepStorage();

  const reachNow = () => basket.reachableFloor(fillerOrders, basket.remaining);

  // Pass 2: floor and paint, when a better match than what's there is affordable.
  const finishes: Selection['finishes'] = { floor: null, wallPaint: null };
  for (const [slot, role, current] of [
    ['floor', 'flooring', room.floor],
    ['wallPaint', 'paint', room.wallPaint],
  ] as const) {
    const options = input.catalogue.filter(
      (item) => isFinish(item) && roleOf(item) === role && fitsRoomType(item, room.type),
    );
    if (!options.length) continue;
    const score = (item: CatalogueItem) => styleScore(item, weights);
    const best = [...options].sort((a, b) => score(b) - score(a) || pricing.price(a) - pricing.price(b))[0] as CatalogueItem;
    const existing = current ? byId.get(current) : undefined;
    if (existing && (existing.id === best.id || score(best) < score(existing) * FINISH_SWITCH_MARGIN)) continue;
    const price = pricing.price(best);
    if (price > basket.remaining || basket.reachableFloor(fillerOrders, basket.remaining - price) < reachNow()) continue;
    basket.remaining -= price;
    finishes[slot] = {
      uid: `finish:${slot}`,
      item: best,
      cost: price,
      owned: false,
      source: 'buy',
      mustHave: false,
      score: score(best),
    };
  }

  // Pass 3: nice-to-haves that don't cost the room its floor cover.
  for (;;) {
    const reachable = reachNow();
    const next = pool
      .filter(
        (item) =>
          basket.canHold(item) &&
          styleScore(item, weights) >= MIN_NICE_MATCH &&
          pricing.price(item) <= basket.remaining &&
          basket.reachableAfter(item, fillerOrders) >= reachable,
      )
      .sort(better)[0];
    if (!next) break;
    basket.take(next);
  }

  // Pass 4: density. Rugs and small pieces first: they fill floor without
  // narrowing walkways (rugs are walked on), and they're cheap.
  const densityRank = (item: CatalogueItem) => {
    const shape = isFlat(item) ? 1.6 : item.w * item.h === 1 ? 1.2 : 1;
    return styleScore(item, weights) * shape * Math.pow(REPEAT_DECAY, basket.countById.get(item.id) ?? 0);
  };
  while (basket.floorUsed < limits.targetCells) {
    const affordable = fillers.filter((item) => basket.canHold(item) && pricing.price(item) <= basket.remaining);
    const reachable = reachNow();
    const onTrack = affordable.filter((item) => basket.reachableAfter(item, fillerOrders) >= reachable);
    const next = onTrack.length
      ? onTrack.sort((a, b) => densityRank(b) - densityRank(a))[0]
      : affordable.sort((a, b) => floorArea(b) / (pricing.price(b) || 1) - floorArea(a) / (pricing.price(a) || 1))[0];
    if (!next) break;
    basket.take(next);
  }

  // Pass 5: finish the walls. Window dressing first, then a few decorative pieces.
  for (let added = 0; added < FINISHING_WALL_PIECES; ) {
    const next = pool
      .filter(
        (item) =>
          item.placement === 'wallmount' &&
          item.stars <= 1 &&
          basket.canHold(item) &&
          pricing.price(item) <= basket.remaining &&
          tagMatch(item, weights) >= 0.5,
      )
      .sort(
        (a, b) => Number(isWindowDressing(b)) - Number(isWindowDressing(a)) || styleScore(b, weights) - styleScore(a, weights),
      )[0];
    if (!next) break;
    basket.take(next);
    if (!isWindowDressing(next)) added++;
  }

  const finishCost = (finishes.floor?.cost ?? 0) + (finishes.wallPaint?.cost ?? 0);
  const total = basket.picks.reduce((sum, p) => sum + p.cost, 0) + finishCost;
  return {
    picks: basket.picks,
    finishes,
    total,
    left: budget - total,
    budget,
    missing,
    minimumForBasics,
    plannedCoverage: usable > 0 ? basket.floorUsed / usable : 0,
    sellSuggestions,
  };
}
