import type { Arrangement } from '../engine/arrange';
import type { Pick } from '../engine/select';
import { naira } from '../lib/naira';

interface ReceiptProps {
  arrangement: Arrangement;
  wallet: number;
  paid: boolean;
  selectedUid: string | null;
  onSelect: (uid: string | null) => void;
}

interface Line {
  key: string;
  name: string;
  qty: number;
  amount: number;
  ownedCount: number;
  uids: string[];
  running: number;
}

/** Collapses repeat picks of one item into a single line with a quantity. */
function toLines(picks: Pick[]): Line[] {
  const lines: Line[] = [];
  const byId = new Map<string, Line>();
  for (const pick of picks) {
    let line = byId.get(pick.item.id);
    if (!line) {
      line = { key: pick.item.id, name: pick.item.name, qty: 0, amount: 0, ownedCount: 0, uids: [], running: 0 };
      byId.set(pick.item.id, line);
      lines.push(line);
    }
    line.qty += 1;
    line.amount += pick.cost;
    if (pick.owned) line.ownedCount += 1;
    line.uids.push(pick.uid);
  }
  let running = 0;
  for (const line of lines) {
    running += line.amount;
    line.running = running;
  }
  return lines;
}

const dateFormat = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

export function Receipt({ arrangement, wallet, paid, selectedUid, onSelect }: ReceiptProps) {
  const lines = toLines(arrangement.placed);
  const { total, budget, left, dropped } = arrangement;
  const short = total - wallet;

  return (
    <section className={`receipt${paid ? ' is-paid' : ''}`} aria-label="Receipt">
      <header className="receipt-head">
        <p className="receipt-shop">Fixam furnishing</p>
        <p className="receipt-meta">
          {dateFormat.format(new Date())} · “{arrangement.vibe}”
        </p>
      </header>

      <ol className="receipt-lines">
        {lines.map((line) => {
          const active = selectedUid !== null && line.uids.includes(selectedUid);
          const free = line.amount === 0;
          return (
            <li key={line.key} className={active ? 'is-active' : undefined}>
              <button
                type="button"
                className="receipt-line"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : line.uids[0] ?? null)}
              >
                <span className="receipt-name">
                  {line.name}
                  {line.qty > 1 && <span className="receipt-qty"> ×{line.qty}</span>}
                  {line.ownedCount > 0 && (
                    <span className="receipt-note">
                      {line.ownedCount === line.qty ? 'Already yours' : `${line.ownedCount} already yours`}
                    </span>
                  )}
                </span>
                <span className="receipt-amount">{free ? '₦0' : naira(line.amount)}</span>
                <span className="receipt-running">{naira(line.running)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <dl className="receipt-sums">
        <div>
          <dt>Total</dt>
          <dd className="receipt-total">{naira(total)}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{naira(budget)}</dd>
        </div>
        <div className={left >= 0 ? 'is-under' : 'is-over'}>
          <dt>{left >= 0 ? 'Left over' : 'Over budget'}</dt>
          <dd>{naira(Math.abs(left))}</dd>
        </div>
        {!paid && (
          <div className={short > 0 ? 'is-over' : undefined}>
            <dt>In your wallet</dt>
            <dd>{naira(wallet)}</dd>
          </div>
        )}
      </dl>

      {dropped.length > 0 && (
        <p className="receipt-footnote">
          Didn’t fit the room, so not charged: {[...new Set(dropped.map((p) => p.item.name.toLowerCase()))].join(', ')}.
        </p>
      )}

      {paid && (
        <p className="receipt-stamp" aria-label="Paid">
          Paid
        </p>
      )}
    </section>
  );
}
