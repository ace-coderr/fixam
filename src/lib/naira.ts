const formatter = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

/** ₦125,000 */
export function naira(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}₦${formatter.format(Math.abs(Math.round(amount)))}`;
}

/** Reads "₦150,000", "150k", "1.2m" or "150000" as a whole number of naira. */
export function parseNaira(input: string): number | null {
  const cleaned = input.toLowerCase().replace(/[₦,\s]|ngn|naira/g, '');
  const match = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(cleaned);
  if (!match) return null;
  const value = Number(match[1]) * (match[2] === 'm' ? 1_000_000 : match[2] === 'k' ? 1_000 : 1);
  return Number.isFinite(value) ? Math.round(value) : null;
}

/** 150000 → "150,000", for the budget field. */
export function groupDigits(amount: number): string {
  return formatter.format(Math.round(amount));
}
