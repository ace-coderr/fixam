import type { GameAdapter, PlacedItem } from '../adapter/types';
import type { Arrangement, PlanStep } from './arrange';

/**
 * Carries out a plan through the game.
 *
 * Full service (the game lets Fixam buy and place): Fixam buys the pieces
 * through the game's own shop, which charges the player's wallet directly,
 * then places everything and applies the finishes. Fixam's fee is charged
 * last, once the room is done. Fixam never holds the player's money and takes
 * no margin on furniture.
 *
 * Plan only: the player pays Fixam's fee and gets the step-by-step list to
 * buy and place things themselves.
 */

export type ExecuteOutcome =
  | { ok: true; mode: 'full-service'; feeCharged: boolean }
  | { ok: true; mode: 'plan-only'; steps: PlanStep[] }
  | {
      ok: false;
      message: string;
      /** True once any money has left the player's wallet. */
      charged: boolean;
      /** Picks up where it failed without buying anything twice. */
      retry?: () => Promise<ExecuteOutcome>;
    };

export async function executePlan(adapter: GameAdapter, plan: Arrangement): Promise<ExecuteOutcome> {
  try {
    if (plan.mode === 'plan-only') {
      const paid = await adapter.charge(plan.fee, `Fixam plan: ${plan.room.label}`);
      if (!paid.ok) {
        return { ok: false, charged: false, message: 'Payment didn’t go through, so nothing was charged. Check your wallet and try again.' };
      }
      return { ok: true, mode: 'plan-only', steps: plan.steps };
    }

    const wallet = await adapter.getWallet();
    if (wallet.naira < plan.grandTotal) {
      return {
        ok: false,
        charged: false,
        message: 'There isn’t enough in your wallet for this plan any more. Lower the budget and plan again.',
      };
    }

    const purchases = plan.purchases;
    const bought = purchases.length
      ? await adapter.buyItems(purchases.map((p) => p.item.id))
      : { ok: true, stored: [] };
    if (!bought.ok || bought.stored.length !== purchases.length) {
      return { ok: false, charged: false, message: 'The shop didn’t complete the purchase, so nothing was charged. Try again.' };
    }

    // Bought pieces now sit in storage under new ids; point the layout at them.
    const storedFor = new Map(purchases.map((p, i) => [p.uid, bought.stored[i]?.uid as string]));
    const layout: PlacedItem[] = plan.layout.map((p) => ({ ...p, uid: storedFor.get(p.uid) ?? p.uid }));

    const finish = async (): Promise<ExecuteOutcome> => {
      const placed = await adapter.placeItems(plan.room.id, layout, plan.finishes);
      if (!placed.ok) {
        return {
          ok: false,
          charged: true,
          message: 'Your pieces are bought and waiting in storage, but placing them didn’t finish. Try again; you won’t pay twice.',
          retry: finish,
        };
      }
      const fee = plan.fee > 0 ? await adapter.charge(plan.fee, `Fixam: ${plan.room.label}`) : { ok: true };
      return { ok: true, mode: 'full-service', feeCharged: fee.ok };
    };
    return await finish();
  } catch {
    return { ok: false, charged: false, message: 'Fixam lost contact with the game. Check your connection and try again.' };
  }
}
