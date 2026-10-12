import type { CatalogueItem } from '../adapter/types';

/**
 * How paint and floor finishes look: a wall colour, or a floor pattern that
 * tiles across the plan. Finishes the game adds later get a look from their
 * name and tags.
 */

type FloorKind = 'terrazzo' | 'parquet' | 'marble-light' | 'marble-dark' | 'plain';

const PAINT_COLOURS: Record<string, string> = {
  'paint-classic-cream': '#EFE3C8',
  'paint-lagos-sky': '#8EC3E6',
  'paint-mint-fresh': '#A8DCC1',
  'paint-peach-glow': '#F4B98E',
  'paint-soft-lilac': '#C9B6E4',
  'paint-naija-green': '#1F8A4C',
  'paint-lekki-charcoal': '#3A3F47',
  'paint-owambe-gold': '#D4A437',
};

const FLOOR_KINDS: Record<string, FloorKind> = {
  'floor-terrazzo': 'terrazzo',
  'floor-wood-parquet': 'parquet',
  'floor-white-marble': 'marble-light',
  'floor-black-marble': 'marble-dark',
};

const FLOOR_BASE: Record<FloorKind, string> = {
  terrazzo: '#E7DFD1',
  parquet: '#B98352',
  'marble-light': '#F2F0EB',
  'marble-dark': '#2C2E34',
  plain: '#EDE7DA',
};

export function paintColour(item: CatalogueItem | undefined): string | null {
  if (!item) return null;
  const known = PAINT_COLOURS[item.id];
  if (known) return known;
  const words = `${item.name} ${item.tags.join(' ')}`.toLowerCase();
  if (/charcoal|black|dark/.test(words)) return '#3A3F47';
  if (/gold/.test(words)) return '#D4A437';
  if (/green/.test(words)) return '#5FAF7E';
  if (/blue|sky|cool/.test(words)) return '#8EC3E6';
  if (/pink|peach|warm/.test(words)) return '#F4B98E';
  if (/lilac|purple|pastel/.test(words)) return '#C9B6E4';
  return '#E9DEC6';
}

export function floorKind(item: CatalogueItem | undefined): FloorKind {
  if (!item) return 'plain';
  const known = FLOOR_KINDS[item.id];
  if (known) return known;
  const name = item.name.toLowerCase();
  if (/terrazzo/.test(name)) return 'terrazzo';
  if (/wood|parquet|plank/.test(name)) return 'parquet';
  if (/marble/.test(name)) return /black|dark/.test(name) ? 'marble-dark' : 'marble-light';
  return 'plain';
}

export function isDarkFloor(item: CatalogueItem | undefined): boolean {
  return floorKind(item) === 'marble-dark';
}

/** Speckles for terrazzo, fixed so the pattern doesn't shimmer between renders. */
const SPECKLES: [number, number, number, string][] = [
  [5, 6, 1.3, '#B5523B'], [17, 4, 0.9, '#8A8F99'], [30, 9, 1.4, '#D29A3A'], [42, 5, 1, '#6F5E92'],
  [10, 19, 1, '#8A8F99'], [24, 22, 1.5, '#B5523B'], [38, 18, 0.9, '#2E7D5B'], [6, 33, 1.2, '#D29A3A'],
  [19, 37, 0.9, '#6F5E92'], [33, 31, 1.2, '#8A8F99'], [44, 40, 1.4, '#B5523B'], [27, 44, 1, '#2E7D5B'],
];

/** Pattern contents for one 48×48 tile. */
function FloorTile({ kind }: { kind: FloorKind }) {
  const base = FLOOR_BASE[kind];
  switch (kind) {
    case 'terrazzo':
      return (
        <>
          <rect width={48} height={48} fill={base} />
          {SPECKLES.map(([x, y, r, c]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c} />
          ))}
        </>
      );
    case 'parquet': {
      const plank = '#8E5E35';
      return (
        <>
          <rect width={48} height={48} fill={base} />
          <path d="M0 8 H24 M0 16 H24 M24 0 V24 M32 0 V24 M40 0 V24 M24 32 H48 M24 40 H48 M8 24 V48 M16 24 V48 M0 24 H48 M24 0 V48" stroke={plank} strokeWidth={0.8} opacity={0.75} />
        </>
      );
    }
    case 'marble-light':
    case 'marble-dark': {
      const vein = kind === 'marble-light' ? '#C9C5BC' : '#70737C';
      return (
        <>
          <rect width={48} height={48} fill={base} />
          <path d="M-2 12 C10 8, 18 20, 30 14 S44 4, 50 10 M-2 36 C8 30, 20 42, 32 34 S46 30, 50 38 M14 -2 C16 10, 10 18, 16 30" fill="none" stroke={vein} strokeWidth={0.9} opacity={0.8} />
        </>
      );
    }
    default:
      return <rect width={48} height={48} fill={base} />;
  }
}

/** A <pattern> for the floor, to use as a fill. */
export function FloorPattern({ id, item }: { id: string; item: CatalogueItem | undefined }) {
  return (
    <pattern id={id} width={48} height={48} patternUnits="userSpaceOnUse">
      <FloorTile kind={floorKind(item)} />
    </pattern>
  );
}

/** A small square swatch for a receipt line. */
export function FinishSwatch({ item }: { item: CatalogueItem }) {
  const isPaint = item.tags.includes('paint') || !/floor|terrazzo|parquet|marble/i.test(item.name + item.tags.join(' '));
  if (isPaint) {
    const colour = paintColour(item) ?? '#E9DEC6';
    return (
      <svg viewBox="0 0 30 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width={30} height={30} fill={colour} />
        {/* A fresh brush stroke across the chip. */}
        <path d="M-2 12 C6 6, 16 16, 32 8" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.28} />
        <path d="M-2 22 C8 18, 18 26, 32 20 V32 H-2 Z" fill="#000" opacity={0.1} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <FloorTile kind={floorKind(item)} />
    </svg>
  );
}
