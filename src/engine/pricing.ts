import type { CatalogueItem, Room } from '../adapter/types';

/**
 * Prices. The game scales every base price by a multiplier tied to the
 * player's net worth, so a ₦500 plastic chair costs ₦25,000 at the Big Man
 * table. Everything Fixam shows or budgets is a displayed price.
 */

export interface PriceTier {
  id: string;
  label: string;
  /** Lowest net worth, in naira, that lands a player in this tier. */
  minNetWorth: number;
  multiplier: number;
}

/** Tiers, lowest first. Add a row here to add a tier; nothing else changes. */
export const PRICE_TIERS: readonly PriceTier[] = [
  { id: 'starter', label: 'Starter', minNetWorth: 0, multiplier: 1 },
  { id: 'mid', label: 'Mid', minNetWorth: 10_000_000, multiplier: 10 },
  { id: 'big-man', label: 'Big Man', minNetWorth: 100_000_000_000, multiplier: 50 },
];

/** The tier for a net worth. The live game reports its own multiplier; this mirrors its table. */
export function priceTierFor(netWorth: number): PriceTier {
  let tier = PRICE_TIERS[0] as PriceTier;
  for (const candidate of PRICE_TIERS) {
    if (netWorth >= candidate.minNetWorth) tier = candidate;
  }
  return tier;
}

/** Share of the displayed list price the game pays back when you sell. */
export const RESALE_SHARE = 0.6;

export type ExecutionMode = 'full-service' | 'plan-only';

export interface Pricing {
  multiplier: number;
  /** Displayed price for any base amount. */
  scale(base: number): number;
  /** Displayed price of an item. */
  price(item: CatalogueItem): number;
  /** What the game pays when the player sells the item. */
  resale(item: CatalogueItem): number;
}

export function createPricing(multiplier: number): Pricing {
  const m = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  const scale = (base: number) => Math.round(base * m);
  return {
    multiplier: m,
    scale,
    price: (item) => scale(item.basePrice),
    resale: (item) => Math.round(scale(item.basePrice) * RESALE_SHARE),
  };
}

/**
 * Fixam's own charge for designing a room. It depends on the room's size and
 * the kind of job, never on what the furniture costs: Fixam takes no margin
 * on furniture. Doing the buying and placing costs more than a plan alone.
 */
const FEE_BASE: Record<ExecutionMode, { flat: number; perCell: number }> = {
  'full-service': { flat: 1_500, perCell: 30 },
  'plan-only': { flat: 500, perCell: 10 },
};

export function serviceFee(room: Room, mode: ExecutionMode, pricing: Pricing): number {
  const { flat, perCell } = FEE_BASE[mode];
  const base = flat + perCell * room.widthCells * room.heightCells;
  return Math.round(pricing.scale(base) / 100) * 100;
}
