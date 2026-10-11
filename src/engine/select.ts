import type { RoomSpec } from '../adapter/types';
import { catalogue as defaultCatalogue, type CatalogueItem, type Category } from '../data/catalogue';
import { usableCells } from './solver';
import type { TagWeights } from './vibes';

/**
 * Chooses what to buy, in three passes:
 *
 *  1. Must-haves (bed, seating, light, storage): best vibe match per category.
 *  2. Nice-to-haves: highest vibe match × priority first.
 *  3. Density: supporting pieces (rugs, stools, lamps, plants, wall decor) until
 *     the furniture covers enough of the floor to look furnished.
 *
 * Every pass holds money back for the passes after it, so a big-ticket pick
 * can never leave the room half empty. The total never exceeds the budget.
 */

export const mustHaveCategories: Category[] = ['sleep', 'seating', 'light', 'storage'];

/** A furnished room covers this share of its usable floor. */
export const COVERAGE_BAND = { low: 0.45, high: 0.6 } as const;

/** What the selector aims for by footprint. Above the band's floor, because rugs and furniture overlap a little once placed. */
export const DEFAULT_COVERAGE_TARGET = 0.53;

/** How many picks one room takes from each category in passes 1 and 2. */
const categoryCaps: Record<Category, number> = {
  sleep: 1,
  seating: 3,
  light: 2,
  storage: 3,
  table: 2,
  desk: 1,
  media: 1,
  power: 2,
  cooling: 1,
  kitchen: 1,
  decor: 3,
  rug: 1,
  window: 1,
};

/** Looser caps for the density pass, which only adds supporting pieces. */
const densityCaps: Partial<Record<Category, number>> = {
  seating: 6,
  light: 3,
  table: 4,
  decor: 6,
  rug: 2,
};

/** Share of the floor solid furniture may cover, leaving room to walk. */
const SOLID_FLOOR_SHARE = 0.38;
/** Share of the wall length wall-mounted items may use. */
const WALL_SHARE = 0.45;
/** Items scoring below this tag match are off-vibe and skipped as nice-to-haves. */
const MIN_NICE_MATCH = 0.9;
/** Wall pieces the density pass adds to finish a room, once the floor is covered. */
const FINISHING_WALL_PIECES = 3;
/** Each extra copy of a multi-buy item is worth less than the one before. */
const REPEAT_DECAY = 0.55;
const OWNED_BONUS = 1.3;

export interface Pick {
  uid: string;
  item: CatalogueItem;
  /** What the player pays. Zero for something they already own. */
  cost: number;
  owned: boolean;
  mustHave: boolean;
  score: number;
}

export interface Selection {
  picks: Pick[];
  total: number;
  left: number;
  budget: number;
  /** Must-have categories the budget couldn't cover. */
  missing: Category[];
  /** The least a room with every must-have could cost this player. */
  minimumForBasics: number;
  /** Footprint of the floor pieces as a share of usable floor, before placement. */
  plannedCoverage: number;
}

export interface SelectInput {
  weights: TagWeights;
  budget: number;
  room: RoomSpec;
  owned: string[];
  items?: CatalogueItem[];
  /** Share of usable floor to fill by footprint. Defaults to DEFAULT_COVERAGE_TARGET. */
  coverageTarget?: number;
}

/** How well an item matches the vibe. 1 is neutral. */
export function tagMatch(item: CatalogueItem, weights: TagWeights): number {
  const sum = item.tags.reduce((acc, tag) => acc + (weights[tag] ?? 0), 0);
  return Math.max(0.1, 1 + sum / Math.sqrt(item.tags.length));
}

function fitsRoom(item: CatalogueItem, room: RoomSpec): boolean {
  if (item.placement === 'wallmount') return true;
  const long = Math.max(item.w, item.h);
  const short = Math.min(item.w, item.h);
  return long <= Math.max(room.widthCells, room.heightCells) && short <= Math.min(room.widthCells, room.heightCells);
}

/** Floor cells an item takes up. Wall-mounted pieces take none. */
function floorArea(item: CatalogueItem): number {
  return item.placement === 'wallmount' ? 0 : item.w * item.h;
}

type Pass = 'core' | 'density';

interface Limits {
  solidCap: number;
  floorCap: number;
  wallCap: number;
  /** Corners not taken by the doorway. */
  cornerCap: number;
  targetCells: number;
}

/** The running shopping list. Cheap to copy, so passes can try a pick before committing. */
class Basket {
  picks: Pick[] = [];
  countById = new Map<string, number>();
  countByCategory = new Map<Category, number>();
  ownedLeft: Set<string>;
  remaining: number;
  solidUsed = 0;
  floorUsed = 0;
  wallUsed = 0;
  cornersUsed = 0;

  constructor(
    readonly weights: TagWeights,
    readonly limits: Limits,
    owned: Iterable<string>,
    budget: number,
  ) {
    this.ownedLeft = new Set(owned);
    this.remaining = budget;
  }

  clone(): Basket {
    const copy = new Basket(this.weights, this.limits, this.ownedLeft, this.remaining);
    copy.picks = [...this.picks];
    copy.countById = new Map(this.countById);
    copy.countByCategory = new Map(this.countByCategory);
    copy.solidUsed = this.solidUsed;
    copy.floorUsed = this.floorUsed;
    copy.wallUsed = this.wallUsed;
    copy.cornersUsed = this.cornersUsed;
    return copy;
  }

  costOf(item: CatalogueItem): number {
    return this.ownedLeft.has(item.id) ? 0 : item.naira;
  }

  scoreOf(item: CatalogueItem): number {
    const copies = this.countById.get(item.id) ?? 0;
    const owned = this.ownedLeft.has(item.id) ? OWNED_BONUS : 1;
    return tagMatch(item, this.weights) * item.priority * owned * Math.pow(REPEAT_DECAY, copies);
  }

  canHold(item: CatalogueItem, pass: Pass): boolean {
    if ((this.countById.get(item.id) ?? 0) >= (item.maxQty ?? 1)) return false;
    const cap = Math.max(categoryCaps[item.category], pass === 'density' ? densityCaps[item.category] ?? 0 : 0);
    if ((this.countByCategory.get(item.category) ?? 0) >= cap) return false;
    if (item.placement === 'wallmount') return !!item.onWindow || this.wallUsed + item.w <= this.limits.wallCap;
    if (item.placement === 'corner' && this.cornersUsed >= this.limits.cornerCap) return false;
    const area = floorArea(item);
    if (this.floorUsed + area > this.limits.floorCap) return false;
    return item.flat || this.solidUsed + area <= this.limits.solidCap;
  }

  needsMet(item: CatalogueItem): boolean {
    return !item.needs || this.picks.some((p) => item.needs!.includes(p.item.id) || item.needs!.includes(p.item.category));
  }

  take(item: CatalogueItem, mustHave: boolean): void {
    const cost = this.costOf(item);
    const copies = this.countById.get(item.id) ?? 0;
    this.picks.push({ uid: `${item.id}:${copies + 1}`, item, cost, owned: cost === 0, mustHave, score: this.scoreOf(item) });
    this.ownedLeft.delete(item.id);
    this.countById.set(item.id, copies + 1);
    this.countByCategory.set(item.category, (this.countByCategory.get(item.category) ?? 0) + 1);
    this.remaining -= cost;
    if (item.placement === 'wallmount') {
      if (!item.onWindow) this.wallUsed += item.w;
    } else {
      this.floorUsed += floorArea(item);
      if (!item.flat) this.solidUsed += floorArea(item);
      if (item.placement === 'corner') this.cornersUsed += 1;
    }
  }

  /** This basket with `item` added, for trying a pick out. */
  with(item: CatalogueItem): Basket {
    const next = this.clone();
    next.take(item, false);
    return next;
  }

  /**
   * How much floor this basket could cover, up to the target, if `money` were
   * spent on the cheapest-per-cell supporting pieces.
   */
  reachableFloor(pool: CatalogueItem[], money: number): number {
    if (this.floorUsed >= this.limits.targetCells) return this.limits.targetCells;
    const sim = this.clone();
    let left = money;
    const fillers = pool
      .filter((item) => item.support && floorArea(item) > 0)
      .sort((a, b) => sim.costOf(a) / floorArea(a) - sim.costOf(b) / floorArea(b));
    for (const item of fillers) {
      while (sim.floorUsed < this.limits.targetCells && sim.canHold(item, 'density') && sim.costOf(item) <= left) {
        left -= sim.costOf(item);
        sim.take(item, false);
      }
    }
    return Math.min(sim.floorUsed, this.limits.targetCells);
  }

  /** Floor still reachable after buying `item`, keeping `holdBack` aside for other things. */
  reachableAfter(item: CatalogueItem, pool: CatalogueItem[], holdBack = 0): number {
    return this.with(item).reachableFloor(pool, this.remaining - this.costOf(item) - holdBack);
  }
}

/** Corners the doorway's clearance zone runs into. */
function doorCorners(room: RoomSpec): number {
  const { door } = room;
  const length = door.wall === 'north' || door.wall === 'south' ? room.widthCells : room.heightCells;
  return Number(door.offset === 0) + Number(door.offset + door.width === length);
}

export function select(input: SelectInput): Selection {
  const { weights, room } = input;
  const budget = Math.max(0, Math.floor(input.budget));
  const pool = (input.items ?? defaultCatalogue).filter((item) => fitsRoom(item, room));

  const usable = usableCells(room);
  const roomCells = room.widthCells * room.heightCells;
  const target = Math.min(input.coverageTarget ?? DEFAULT_COVERAGE_TARGET, COVERAGE_BAND.high);
  const limits: Limits = {
    solidCap: Math.floor(roomCells * SOLID_FLOOR_SHARE),
    floorCap: Math.floor(usable * COVERAGE_BAND.high),
    wallCap: Math.floor(2 * (room.widthCells + room.heightCells) * WALL_SHARE),
    cornerCap: 4 - doorCorners(room),
    targetCells: Math.ceil(usable * target),
  };
  const basket = new Basket(weights, limits, input.owned, budget);

  const better = (a: CatalogueItem, b: CatalogueItem) => {
    const diff = basket.scoreOf(b) - basket.scoreOf(a);
    return diff !== 0 ? diff : basket.costOf(a) - basket.costOf(b);
  };

  const cheapestIn = (category: Category) => {
    const costs = pool.filter((item) => item.category === category && !item.needs).map((item) => basket.costOf(item));
    return costs.length ? Math.min(...costs) : Infinity;
  };

  const minimumForBasics = mustHaveCategories.reduce((sum, c) => sum + cheapestIn(c), 0);

  // Pass 1: must-haves. Hold back enough for the remaining must-haves and,
  // where the budget allows, for filling the floor afterwards.
  const missing: Category[] = [];
  mustHaveCategories.forEach((category, index) => {
    const laterMustHaves = mustHaveCategories.slice(index + 1).reduce((sum, later) => sum + cheapestIn(later), 0);
    const options = pool.filter(
      (item) =>
        item.category === category && !item.needs && basket.canHold(item, 'core') && basket.costOf(item) <= basket.remaining,
    );
    const keepsBasics = options.filter((item) => basket.costOf(item) <= basket.remaining - laterMustHaves);
    // Among the choices that keep the basics affordable, take the best match that
    // can still reach the coverage target; failing that, whichever gets closest.
    const candidates = keepsBasics.length ? keepsBasics : options;
    const reach = new Map(candidates.map((item) => [item, basket.reachableAfter(item, pool, laterMustHaves)]));
    const furthest = Math.max(0, ...reach.values());
    const choice = candidates
      .filter((item) => reach.get(item) === furthest || (reach.get(item) ?? 0) >= limits.targetCells)
      .sort(better)[0];
    if (choice) basket.take(choice, true);
    else missing.push(category);
  });

  // Pass 2: nice-to-haves, only those that don't cost the room its floor cover.
  const reachNow = () => basket.reachableFloor(pool, basket.remaining);
  for (;;) {
    const reachable = reachNow();
    const next = pool
      .filter(
        (item) =>
          basket.canHold(item, 'core') &&
          basket.needsMet(item) &&
          tagMatch(item, weights) >= MIN_NICE_MATCH &&
          basket.costOf(item) <= basket.remaining &&
          basket.reachableAfter(item, pool) >= reachable,
      )
      .sort(better)[0];
    if (!next) break;
    basket.take(next, false);
  }

  // Pass 3: density. Rugs and small decorative pieces first: they fill the
  // floor without narrowing walkways (rugs are walked on), and they're cheap.
  const support = pool.filter((item) => item.support);
  const densityRank = (item: CatalogueItem) => {
    const shape = item.flat ? 1.6 : item.w * item.h === 1 ? 1.2 : 1;
    return tagMatch(item, weights) * shape * Math.pow(REPEAT_DECAY, basket.countById.get(item.id) ?? 0);
  };
  const byDensityRank = (a: CatalogueItem, b: CatalogueItem) => densityRank(b) - densityRank(a);

  while (basket.floorUsed < limits.targetCells) {
    const affordable = support.filter(
      (item) =>
        floorArea(item) > 0 && basket.canHold(item, 'density') && basket.needsMet(item) && basket.costOf(item) <= basket.remaining,
    );
    // Prefer picks that keep the target in reach; otherwise take whatever covers most per naira.
    const reachable = reachNow();
    const onTrack = affordable.filter((item) => basket.reachableAfter(item, pool) >= reachable);
    const next = onTrack.length
      ? onTrack.sort(byDensityRank)[0]
      : affordable.sort((a, b) => floorArea(b) / (basket.costOf(b) || 1) - floorArea(a) / (basket.costOf(a) || 1))[0];
    if (!next) break;
    basket.take(next, false);
  }

  // Finish the walls: curtains first if there are none, then a few decorative pieces.
  for (let added = 0; added < FINISHING_WALL_PIECES; ) {
    const next = support
      .filter(
        (item) =>
          item.placement === 'wallmount' &&
          basket.canHold(item, 'density') &&
          basket.costOf(item) <= basket.remaining &&
          tagMatch(item, weights) >= 0.5,
      )
      .sort((a, b) => Number(!!b.onWindow) - Number(!!a.onWindow) || byDensityRank(a, b))[0];
    if (!next) break;
    basket.take(next, false);
    if (!next.onWindow) added++;
  }

  const total = basket.picks.reduce((sum, p) => sum + p.cost, 0);
  return {
    picks: basket.picks,
    total,
    left: budget - total,
    budget,
    missing,
    minimumForBasics,
    plannedCoverage: usable > 0 ? basket.floorUsed / usable : 0,
  };
}
