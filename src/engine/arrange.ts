import type {
  Capabilities,
  CatalogueItem,
  Finishes,
  PlacedItem,
  Room,
  Rotation,
  StoredItem,
  Wall,
} from '../adapter/types';
import { naira } from '../lib/naira';
import { serviceFee, type ExecutionMode, type Pricing } from './pricing';
import { select, type Pick, type Selection, type SellSuggestion } from './select';
import { facing, floorCoverage, layoutDistance, solve, usableCells } from './solver';
import { COVERAGE_BANDS, MUST_HAVES, roleOf, type Role } from './traits';
import { readVibe, styleWeights, type Leaning, type TagWeights, type VibeReading } from './vibes';

/**
 * Runs Arrange for one room: read the vibe, choose pieces (storage first),
 * place them, and write the plan up as a receipt and, when Fixam can't do the
 * job itself, a step-by-step list for the player.
 */

export interface ArrangeRequest {
  vibe: string;
  /** The player's explicit choice. Shifts style weights; never restricts categories. */
  leaning: Leaning;
  /** Everything the player will pay, Fixam's fee included, at displayed prices. */
  budget: number;
  room: Room;
  catalogue: CatalogueItem[];
  storage: StoredItem[];
  pricing: Pricing;
  capabilities: Capabilities;
}

/** One instruction in a place-it-yourself plan. */
export interface PlanStep {
  order: number;
  action: 'paint' | 'floor' | 'place';
  itemId: string;
  name: string;
  source: 'storage' | 'buy';
  /** Displayed price when it has to be bought, else 0. */
  price: number;
  x?: number;
  y?: number;
  rotation?: Rotation;
  facing?: Wall;
  text: string;
}

export interface Arrangement {
  vibe: string;
  leaning: Leaning;
  reading: VibeReading;
  room: Room;
  mode: ExecutionMode;
  layout: PlacedItem[];
  /** Pieces and finishes in the plan, in receipt order. */
  placed: Pick[];
  /** Pieces that were affordable but didn't fit. Never charged. */
  dropped: Pick[];
  /** Everything the plan buys (not storage), finishes included. */
  purchases: Pick[];
  /** Finishes the plan applies, by catalogue id. */
  finishes: Finishes;
  /** Furniture and finishes, at displayed prices. */
  total: number;
  /** Fixam's service fee for this job. */
  fee: number;
  /** total + fee: what the player pays. */
  grandTotal: number;
  /** Budget minus the grand total. */
  left: number;
  budget: number;
  /** Share of usable floor covered once placed (0–1). */
  coverage: number;
  /** Placement order, with rotation for each piece. */
  steps: PlanStep[];
  /** Storage pieces that clash with this style, and what they'd sell for. */
  sellSuggestions: SellSuggestion[];
  seed: number;
  /** What the plan was made from, so a reroll can reuse it. */
  context: { selection: Selection; weights: TagWeights; pricing: Pricing };
}

export type ArrangeOutcome = { ok: true; arrangement: Arrangement } | { ok: false; message: string };

/** Receipt order: the room's must-haves first, then the rest, dearest first within each. */
const receiptOrder: Role[] = [
  'bed', 'seat', 'table', 'storage', 'light', 'cooking', 'cold', 'counter', 'toilet', 'wash', 'laundry',
  'desk', 'screen', 'cooling', 'fun', 'luxury', 'vehicle', 'pet', 'rug', 'window', 'plant', 'decor', 'other',
];

/** Reroll keeps trying seeds until at least this share of pieces has moved. */
const MIN_REROLL_CHANGE = 0.5;
const REROLL_TRIES = 8;

export function newSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function executionMode(capabilities: Capabilities): ExecutionMode {
  return capabilities.canBuy && capabilities.canPlace ? 'full-service' : 'plan-only';
}

function coverageTargets(room: Room): number[] {
  const { low, high } = COVERAGE_BANDS[room.type];
  const mid = (low + high) / 2;
  return [mid, (mid + high) / 2, high];
}

const WALL_WORDS: Record<Wall, string> = { north: 'top', east: 'right', south: 'bottom', west: 'left' };

function writeSteps(layout: PlacedItem[], placed: Pick[], finishes: Finishes): PlanStep[] {
  const steps: PlanStep[] = [];
  const add = (step: Omit<PlanStep, 'order'>) => steps.push({ order: steps.length + 1, ...step });

  // Surfaces first, while the room is empty.
  for (const pick of placed) {
    const role = roleOf(pick.item);
    if (role !== 'paint' && role !== 'flooring') continue;
    if (pick.item.id !== finishes.floor && pick.item.id !== finishes.wallPaint) continue;
    const buy = pick.source === 'buy' ? `Buy ${pick.item.name} for ${naira(pick.cost)}` : `Take ${pick.item.name} from storage`;
    add({
      action: role === 'paint' ? 'paint' : 'floor',
      itemId: pick.item.id,
      name: pick.item.name,
      source: pick.source,
      price: pick.cost,
      text: role === 'paint' ? `${buy} and paint the walls.` : `${buy} and lay it across the floor.`,
    });
  }

  // Then furniture, in the order the solver placed it: anchors, rugs, small pieces, wall pieces.
  const byUid = new Map(placed.map((p) => [p.uid, p]));
  for (const p of layout) {
    const pick = byUid.get(p.uid);
    if (!pick) continue;
    const get = pick.source === 'buy' ? `Buy the ${pick.item.name} (${naira(pick.cost)})` : `Take the ${pick.item.name} from storage`;
    const at = `column ${p.x + 1}, row ${p.y + 1}`;
    const turn = `rotated ${p.rotation}°`;
    const text =
      p.layer === 'wall'
        ? `${get} and hang it on the ${WALL_WORDS[facing(((p.rotation + 180) % 360) as Rotation)]} wall at ${at}, ${turn}.`
        : `${get} and place it at ${at}, ${turn}, facing the ${WALL_WORDS[facing(p.rotation)]} of the room.`;
    add({
      action: 'place',
      itemId: p.itemId,
      name: pick.item.name,
      source: pick.source,
      price: pick.cost,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      facing: facing(p.rotation),
      text,
    });
  }
  return steps;
}

/** What stays the same across every layout of one plan. */
interface PlanBase {
  vibe: string;
  leaning: Leaning;
  reading: VibeReading;
  room: Room;
  mode: ExecutionMode;
  fee: number;
  budget: number;
}

function place(
  request: PlanBase,
  selection: Selection,
  weights: TagWeights,
  pricing: Pricing,
  seed: number,
): ArrangeOutcome {
  const { room } = request;
  const result = solve(
    selection.picks.map((p) => ({ uid: p.uid, item: p.item, keep: p.owned })),
    room,
    seed,
  );
  if (!result.ok) return { ok: false, message: `${result.reason} Try a smaller budget so the list is shorter.` };

  const placedUids = new Set(result.layout.map((p) => p.uid));
  const mustHaves = MUST_HAVES[room.type];
  const rank = (p: Pick) => {
    const role = roleOf(p.item);
    return mustHaves.includes(role) ? mustHaves.indexOf(role) - 100 : receiptOrder.indexOf(role);
  };
  const pieces = selection.picks
    .filter((p) => placedUids.has(p.uid))
    .sort((a, b) => rank(a) - rank(b) || b.cost - a.cost);
  const finishPicks = [selection.finishes.floor, selection.finishes.wallPaint].filter((p): p is Pick => !!p);
  const placed = [...pieces, ...finishPicks];
  const dropped = selection.picks.filter((p) => !placedUids.has(p.uid));
  const total = placed.reduce((sum, p) => sum + p.cost, 0);
  const finishes: Finishes = {
    floor: selection.finishes.floor?.item.id ?? null,
    wallPaint: selection.finishes.wallPaint?.item.id ?? null,
  };

  return {
    ok: true,
    arrangement: {
      vibe: request.vibe,
      leaning: request.leaning,
      reading: request.reading,
      room,
      mode: request.mode,
      layout: result.layout,
      placed,
      dropped,
      purchases: placed.filter((p) => p.source === 'buy'),
      finishes,
      total,
      fee: request.fee,
      grandTotal: total + request.fee,
      left: request.budget - total - request.fee,
      budget: request.budget,
      coverage: floorCoverage(result.layout, room),
      steps: writeSteps(result.layout, placed, finishes),
      sellSuggestions: selection.sellSuggestions,
      seed,
      context: { selection, weights, pricing },
    },
  };
}

export async function arrange(request: ArrangeRequest, seed: number = newSeed()): Promise<ArrangeOutcome> {
  const vibe = request.vibe.trim();
  if (!vibe) return { ok: false, message: 'Describe a vibe, or tap one of the suggestions.' };
  if (!Number.isFinite(request.budget) || request.budget <= 0) {
    return { ok: false, message: 'Enter a budget in naira, like 150,000.' };
  }

  const { room, pricing } = request;
  const mode = executionMode(request.capabilities);
  const fee = serviceFee(room, mode, pricing);
  if (request.budget < fee) {
    return {
      ok: false,
      message: `Fixam's fee for this room is ${naira(fee)}, so the budget needs to be more than that. Raise it and plan again.`,
    };
  }

  const reading = await readVibe(vibe);
  const weights = styleWeights(reading, request.leaning);
  const base: PlanBase = { vibe, leaning: request.leaning, reading, room, mode, fee, budget: request.budget };

  // Placement can leave a piece out, or tuck a rug partly under the furniture,
  // so check real coverage. If the room came out sparse, aim higher and allow
  // for whatever was lost to overlap; keep the plan closest to the band.
  const band = COVERAGE_BANDS[room.type];
  const usable = usableCells(room);
  const distance = (coverage: number) => Math.max(0, band.low - coverage, coverage - band.high);
  let best: Extract<ArrangeOutcome, { ok: true }> | null = null;
  let overlapAllowance = 0;
  for (const target of coverageTargets(room)) {
    const selection = select({
      catalogue: request.catalogue,
      room,
      weights,
      budget: request.budget - fee,
      pricing,
      storage: request.storage,
      coverageTarget: target,
      overlapAllowance,
    });
    if (selection.missing.length > 0) {
      return {
        ok: false,
        message: `That budget can't cover the basics for this room. They start from ${naira(
          selection.minimumForBasics + fee,
        )}, Fixam's fee included. Raise the budget to at least that.`,
      };
    }
    const outcome = place(base, selection, weights, pricing, seed);
    if (!outcome.ok) return outcome;
    const coverage = outcome.arrangement.coverage;
    if (!best || distance(coverage) < distance(best.arrangement.coverage)) best = outcome;
    if (distance(coverage) === 0) break;
    overlapAllowance = Math.max(0, Math.round((selection.plannedCoverage - coverage) * usable));
  }
  return best ?? { ok: false, message: 'Couldn’t plan this room. Try a different vibe or budget.' };
}

/** Same pieces, a different layout that differs visibly from the current one. */
export function rearrange(current: Arrangement, room: Room = current.room): ArrangeOutcome {
  const base: PlanBase = {
    vibe: current.vibe,
    leaning: current.leaning,
    reading: current.reading,
    room,
    mode: current.mode,
    fee: current.fee,
    budget: current.budget,
  };
  const { selection, weights, pricing } = current.context;
  // Rank by: moved enough, stays as furnished as the current plan, then how much moved.
  const rank = (a: Arrangement) => {
    const distance = layoutDistance(current.layout, a.layout);
    const furnished = a.coverage >= Math.min(current.coverage, COVERAGE_BANDS[room.type].low) - 0.005;
    return Number(distance >= MIN_REROLL_CHANGE) * 2 + Number(furnished) + distance / 10;
  };
  let best: ArrangeOutcome | null = null;
  let bestRank = -1;
  for (let i = 0; i < REROLL_TRIES; i++) {
    const outcome = place(base, selection, weights, pricing, newSeed());
    if (!outcome.ok) continue;
    const r = rank(outcome.arrangement);
    if (r > bestRank) {
      best = outcome;
      bestRank = r;
    }
    if (r >= 3) break;
  }
  return best ?? { ok: false, message: 'Couldn’t find another layout. Try a different vibe or budget.' };
}
