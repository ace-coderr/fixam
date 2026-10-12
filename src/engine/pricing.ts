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
 * Fixam's own charge for designing a room: a flat band by room area, at
 * starter prices, scaled by the player's multiplier. It never depends on what
 * the furniture costs: Fixam takes no margin on furniture. Charged when the
 * job completes. Doing the buying and placing costs more than a plan alone.
 */
const FEE_BANDS: { maxCells: number; fee: Record<ExecutionMode, number> }[] = [
  { maxCells: 64, fee: { 'full-service': 3_000, 'plan-only': 1_000 } },
  { maxCells: 121, fee: { 'full-service': 6_000, 'plan-only': 2_000 } },
  { maxCells: Infinity, fee: { 'full-service': 10_000, 'plan-only': 3_500 } },
];

export function serviceFee(room: Room, mode: ExecutionMode, pricing: Pricing): number {
  const cells = room.widthCells * room.heightCells;
  const band = FEE_BANDS.find((b) => cells <= b.maxCells) ?? (FEE_BANDS[FEE_BANDS.length - 1] as (typeof FEE_BANDS)[number]);
  return pricing.scale(band.fee[mode]);
}
