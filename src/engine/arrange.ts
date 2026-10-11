import type { PlacedItem, RoomSpec } from '../adapter/types';
import type { Category } from '../data/catalogue';
import { COVERAGE_BAND, DEFAULT_COVERAGE_TARGET, select, type Pick, type Selection } from './select';
import { floorCoverage, layoutDistance, solve } from './solver';
import { readVibe, type VibeReading } from './vibes';

/**
 * Runs the whole Arrange pipeline: read the vibe, choose items under budget,
 * place them. Items the solver can't fit are left off the bill.
 */

export interface Arrangement {
  vibe: string;
  reading: VibeReading;
  selection: Selection;
  layout: PlacedItem[];
  /** Picks that made it into the room, in receipt order. */
  placed: Pick[];
  /** Picks that were affordable but didn't fit. Never charged. */
  dropped: Pick[];
  total: number;
  left: number;
  budget: number;
  /** Share of usable floor covered once placed (0–1). */
  coverage: number;
  seed: number;
}

export type ArrangeOutcome =
  | { ok: true; arrangement: Arrangement }
  | { ok: false; message: string };

export interface ArrangeRequest {
  vibe: string;
  budget: number;
  room: RoomSpec;
  owned: string[];
}

/** Receipt order: the basics first, then the rest, dearest first within each. */
const receiptOrder: Category[] = [
  'sleep', 'seating', 'storage', 'light', 'table', 'desk', 'media',
  'cooling', 'power', 'kitchen', 'rug', 'window', 'decor',
];

/** Reroll keeps trying seeds until at least this share of items has moved. */
const MIN_REROLL_CHANGE = 0.5;
const REROLL_TRIES = 8;

/** Footprint targets tried in turn until the placed room lands in the coverage band. */
const COVERAGE_TARGETS = [DEFAULT_COVERAGE_TARGET, 0.57, COVERAGE_BAND.high];

export function newSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function formatNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

function place(vibe: string, reading: VibeReading, selection: Selection, room: RoomSpec, seed: number): ArrangeOutcome {
  const result = solve(
    selection.picks.map((p) => ({ uid: p.uid, item: p.item })),
    room,
    seed,
  );
  if (!result.ok) return { ok: false, message: `${result.reason} Try a smaller list by lowering the budget.` };

  const coverage = floorCoverage(result.layout, room);
  const placedUids = new Set(result.layout.map((p) => p.uid));
  const rank = (p: Pick) => receiptOrder.indexOf(p.item.category);
  const placed = selection.picks
    .filter((p) => placedUids.has(p.uid))
    .sort((a, b) => rank(a) - rank(b) || b.cost - a.cost);
  const dropped = selection.picks.filter((p) => !placedUids.has(p.uid));
  const total = placed.reduce((sum, p) => sum + p.cost, 0);

  return {
    ok: true,
    arrangement: {
      vibe,
      reading,
      selection,
      layout: result.layout,
      placed,
      dropped,
      total,
      left: selection.budget - total,
      budget: selection.budget,
      coverage,
      seed,
    },
  };
}

export async function arrange(request: ArrangeRequest, seed: number = newSeed()): Promise<ArrangeOutcome> {
  const vibe = request.vibe.trim();
  if (!vibe) return { ok: false, message: 'Describe a vibe, or tap one of the suggestions.' };
  if (!Number.isFinite(request.budget) || request.budget <= 0) {
    return { ok: false, message: 'Enter a budget in naira, like 150,000.' };
  }

  const reading = await readVibe(vibe);

  // Placement can leave a piece out, or tuck a rug partly under the furniture,
  // so check real coverage and aim a little higher if the room came out sparse.
  let best: ArrangeOutcome | null = null;
  for (const target of COVERAGE_TARGETS) {
    const selection = select({
      weights: reading.weights,
      budget: request.budget,
      room: request.room,
      owned: request.owned,
      coverageTarget: target,
    });
    if (selection.picks.length === 0 || selection.missing.includes('sleep')) {
      return {
        ok: false,
        message: `That budget can't cover the basics. A bed, a seat, a light and storage start from ${formatNaira(
          selection.minimumForBasics,
        )}. Raise the budget to at least that.`,
      };
    }
    const outcome = place(vibe, reading, selection, request.room, seed);
    if (!outcome.ok) return outcome;
    if (!best || (best.ok && outcome.arrangement.coverage > best.arrangement.coverage)) best = outcome;
    if (outcome.arrangement.coverage >= COVERAGE_BAND.low) break;
  }
  return best as ArrangeOutcome;
}

/** Same items, a different layout that differs visibly from the current one. */
export function rearrange(current: Arrangement, room: RoomSpec): ArrangeOutcome {
  // Rank by: moved enough, stays as furnished as the current plan, then how much moved.
  const rank = (a: Arrangement) => {
    const distance = layoutDistance(current.layout, a.layout);
    const furnished = a.coverage >= Math.min(current.coverage, COVERAGE_BAND.low) - 0.005;
    return Number(distance >= MIN_REROLL_CHANGE) * 2 + Number(furnished) * 1 + distance / 10;
  };
  let best: ArrangeOutcome | null = null;
  let bestRank = -1;
  for (let i = 0; i < REROLL_TRIES; i++) {
    const outcome = place(current.vibe, current.reading, current.selection, room, newSeed());
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
