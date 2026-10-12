import type { CatalogueItem } from '../adapter/types';
import type { Arrangement } from '../engine/arrange';
import type { Pick, SellSuggestion } from '../engine/select';
import { isFinish } from '../engine/traits';
import { naira } from '../lib/naira';
import { FinishSwatch } from './finishes';
import { Sprite } from './sprites';

const CELL = 24;

/** A small picture of an item for a receipt line. */
function Thumb({ item }: { item: CatalogueItem }) {
  if (isFinish(item)) {
    return (
      <span className="receipt-thumb" aria-hidden="true">
        <FinishSwatch item={item} />
      </span>
    );
  }
  const w = Math.max(1, item.w) * CELL;
  const h = Math.max(1, item.h) * CELL;
  const side = Math.max(w, h);
  return (
    <span className="receipt-thumb" aria-hidden="true">
      <svg viewBox={`${(w - side) / 2 - 2} ${(h - side) / 2 - 2} ${side + 4} ${side + 4}`}>
        <Sprite item={item} w={w} h={h} />
      </svg>
    </span>
  );
}

function FeeThumb() {
  return (
    <span className="receipt-thumb" aria-hidden="true" style={{ background: 'var(--brass)' }}>
      <svg viewBox="0 0 30 30">
        <text x={15} y={20} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0F1522" fontFamily="var(--font-display), sans-serif">
          A
        </text>
      </svg>
    </span>
  );
}

interface Line {
  key: string;
  item: CatalogueItem;
  qty: number;
  amount: number;
  owned: boolean;
  uids: string[];
}

/** One line per item and source, so owned and bought copies of the same thing read clearly. */
function toLines(picks: Pick[]): Line[] {
  const lines: Line[] = [];
  const byKey = new Map<string, Line>();
  for (const pick of picks) {
    const key = `${pick.item.id}:${pick.owned ? 'owned' : 'bought'}`;
    let line = byKey.get(key);
    if (!line) {
      line = { key, item: pick.item, qty: 0, amount: 0, owned: pick.owned, uids: [] };
      byKey.set(key, line);
      lines.push(line);
    }
    line.qty += 1;
    line.amount += pick.cost;
    line.uids.push(pick.uid);
  }
  return lines;
}

interface ReceiptProps {
  arrangement: Arrangement;
  /** Stamp shown once the job is done, such as "Paid". */
  stamp: string | null;
  selectedUid: string | null;
  onSelect: (uid: string | null) => void;
}

export function Receipt({ arrangement, stamp, selectedUid, onSelect }: ReceiptProps) {
  const lines = toLines(arrangement.placed);
  const { fee, budget, dropped, mode } = arrangement;
  // Everything on screen sums: the lines plus the fee make the total.
  const total = lines.reduce((sum, l) => sum + l.amount, 0) + fee;
  const left = budget - total;
  let running = 0;

  return (
    <section className="card" aria-label="Receipt">
      <div className="receipt-head">
        <h2 className="card-title">Receipt 🧾</h2>
        {stamp ? <span className="receipt-paid">{stamp}</span> : <span className="pill">{mode === 'full-service' ? 'Full service' : 'Plan only'}</span>}
      </div>

      <ol className="receipt-lines">
        {lines.map((line) => {
          running += line.amount;
          const active = selectedUid !== null && line.uids.includes(selectedUid);
          const finish = isFinish(line.item);
          const body = (
            <>
              <Thumb item={line.item} />
              <span className="receipt-name">
                {line.item.name}
                {line.qty > 1 && <span className="muted"> ×{line.qty}</span>}
                {(line.owned || finish) && (
                  <span className="receipt-sub">
                    {line.owned && <span className="pill is-green">Already yours</span>}
                    {finish && <span className="pill">{line.item.tags.includes('paint') ? 'Wall paint' : 'Floor'}</span>}
                  </span>
                )}
              </span>
              <span className="receipt-amount naira">{naira(line.amount)}</span>
              <span className="receipt-running">{naira(running)}</span>
            </>
          );
          return (
            <li key={line.key}>
              {finish ? (
                <div className="receipt-line">{body}</div>
              ) : (
                <button
                  type="button"
                  className="receipt-line"
                  aria-pressed={active}
                  onClick={() => onSelect(active ? null : (line.uids[0] ?? null))}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
        <li>
          <div className="receipt-line">
            <FeeThumb />
            <span className="receipt-name">
              Fixam service fee
              <span className="receipt-sub">
                <span className="pill is-brass">{mode === 'full-service' ? 'Your Ace worker buys and places' : 'Step-by-step plan'}</span>
              </span>
            </span>
            <span className="receipt-amount naira">{naira(fee)}</span>
            <span className="receipt-running">{naira(running + fee)}</span>
          </div>
        </li>
      </ol>

      <dl className="receipt-sums">
        <div className="is-total">
          <dt>Total</dt>
          <dd>{naira(total)}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{naira(budget)}</dd>
        </div>
        <div className={left >= 0 ? 'is-under' : 'is-over'}>
          <dt>{left >= 0 ? 'Left over' : 'Over budget'}</dt>
          <dd>{naira(Math.abs(left))}</dd>
        </div>
      </dl>

      {dropped.length > 0 && (
        <p className="receipt-footnote">
          Didn’t fit the room, so not charged: {[...new Set(dropped.map((p) => p.item.name))].join(', ')}.
        </p>
      )}
    </section>
  );
}

/** Stored pieces that clash with the style, and what selling them would bring back. */
export function SellSuggestions({ suggestions }: { suggestions: SellSuggestion[] }) {
  if (suggestions.length === 0) return null;
  // One line per item, with a count, like the receipt.
  const grouped: { item: CatalogueItem; qty: number; value: number; key: string }[] = [];
  for (const s of suggestions) {
    const line = grouped.find((g) => g.item.id === s.item.id);
    if (line) {
      line.qty += 1;
      line.value += s.value;
    } else {
      grouped.push({ item: s.item, qty: 1, value: s.value, key: s.storedUid });
    }
  }
  let running = 0;
  return (
    <section className="card" aria-label="Sell suggestions">
      <div className="receipt-head">
        <h2 className="card-title">Sell these instead 💸</h2>
      </div>
      <p className="card-meta">In your storage, but they don’t suit this style. The shop buys back at 60% of today’s price.</p>
      <ol className="receipt-lines">
        {grouped.map((s) => {
          running += s.value;
          return (
            <li key={s.key}>
              <div className="receipt-line">
                <Thumb item={s.item} />
                <span className="receipt-name">
                  {s.item.name}
                  {s.qty > 1 && <span className="muted"> ×{s.qty}</span>}
                </span>
                <span className="receipt-amount naira">{naira(s.value)}</span>
                <span className="receipt-running">{naira(running)}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <dl className="receipt-sums">
        <div className="is-total">
          <dt>You’d get back</dt>
          <dd>{naira(running)}</dd>
        </div>
      </dl>
    </section>
  );
}
