import type { ReactElement } from 'react';
import type { CatalogueItem } from '../adapter/types';
import { roleOf } from '../engine/traits';

/**
 * Top-down flat vector drawings. Each is drawn in its own box `w` × `h` (in
 * SVG units) with the back edge at the top, y = 0. Wall-mounted sprites
 * straddle that top edge so they sit on the wall line.
 *
 * The game's catalogue says nothing about looks, so `lookFor` picks a drawing
 * from what an item is and a palette from its category. Items with no drawing
 * of their own get a plain labelled block.
 */

export interface Palette {
  base: string;
  accent: string;
  detail?: string;
}

type SpriteKind =
  | 'mattress' | 'campbed' | 'bed'
  | 'plasticchair' | 'sofa' | 'armchair' | 'bench' | 'cushions' | 'officechair'
  | 'lantern' | 'floorlamp' | 'solar' | 'sconce' | 'bracket'
  | 'wardrobe' | 'fabricwardrobe' | 'bags' | 'drawers' | 'bookshelf' | 'shoerack' | 'cabinet'
  | 'centretable' | 'stool' | 'dining'
  | 'desk' | 'workstation'
  | 'tvstand' | 'smalltv' | 'speaker' | 'walltv'
  | 'gen' | 'jerrycan' | 'inverter' | 'meter'
  | 'fan' | 'ac'
  | 'cooler' | 'fridge'
  | 'mirror' | 'plant' | 'pouf' | 'clock' | 'frames' | 'art' | 'calendar'
  | 'mat' | 'rug'
  | 'curtain' | 'blinds'
  | 'generic';

interface Look {
  palette: Palette;
  /** First letter of the item's name, for the plain block. */
  initial: string;
}

export const OUTLINE = '#0F1522';
const LIGHT = '#F7F3EA';
const GLOW = '#FFF1C9';
const STROKE = 1.1;

interface Box {
  w: number;
  h: number;
}

type Draw = (look: Look, box: Box) => ReactElement;

const line = { stroke: OUTLINE, strokeWidth: STROKE, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/** A rectangle inset from the box edges, with the shared outline. */
function Body({ x = 0, y = 0, w, h, fill, r = 2, inset = 1.5 }: { x?: number; y?: number; w: number; h: number; fill: string; r?: number; inset?: number }) {
  return <rect x={x + inset} y={y + inset} width={Math.max(1, w - inset * 2)} height={Math.max(1, h - inset * 2)} rx={r} fill={fill} {...line} />;
}

const mattress: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={5} />
    <rect x={6} y={5} width={w - 12} height={h * 0.16} rx={4} fill={LIGHT} {...line} />
    <rect x={1.5} y={h * 0.48} width={w - 3} height={h * 0.52 - 1.5} rx={4} fill={palette.accent} opacity={0.85} {...line} />
    <path d={`M${w * 0.3} ${h * 0.6} v${h * 0.28} M${w * 0.7} ${h * 0.6} v${h * 0.28}`} {...line} opacity={0.4} />
  </>
);

const campbed: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.accent} r={2} />
    <path d={`M3 3 V${h - 3} M${w - 3} 3 V${h - 3}`} stroke={palette.base} strokeWidth={3} strokeLinecap="round" />
    <path d={`M4 ${h * 0.33} H${w - 4} M4 ${h * 0.66} H${w - 4}`} {...line} opacity={0.35} />
    <rect x={5} y={4} width={w - 10} height={h * 0.13} rx={3} fill={LIGHT} {...line} />
  </>
);

const bed: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={3} />
    <rect x={1.5} y={1.5} width={w - 3} height={7} rx={2} fill={palette.detail ?? palette.base} {...line} />
    <rect x={5} y={9} width={w - 10} height={h - 13} rx={3} fill={palette.accent} {...line} />
    <rect x={8} y={12} width={w / 2 - 11} height={h * 0.13} rx={3} fill={LIGHT} {...line} />
    <rect x={w / 2 + 3} y={12} width={w / 2 - 11} height={h * 0.13} rx={3} fill={LIGHT} {...line} />
    <rect x={5} y={h * 0.5} width={w - 10} height={h * 0.5 - 4} rx={3} fill={palette.detail ?? palette.base} opacity={0.9} {...line} />
    <path d={`M5 ${h * 0.58} H${w - 5}`} {...line} opacity={0.4} />
  </>
);

const plasticchair: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={4} y={5} width={w - 8} height={h - 8} rx={4} fill={palette.base} {...line} />
    <path d={`M3.5 7 Q${w / 2} -1 ${w - 3.5} 7`} fill="none" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
    <path d={`M3.5 7 Q${w / 2} -1 ${w - 3.5} 7`} fill="none" stroke={palette.base} strokeWidth={2} strokeLinecap="round" />
    <path d={`M8 ${h * 0.5} H${w - 8} M8 ${h * 0.65} H${w - 8}`} stroke={palette.accent} strokeWidth={1} strokeLinecap="round" />
  </>
);

const sofa: Draw = ({ palette }, { w, h }) => {
  const arm = Math.min(7, w * 0.12);
  const seats = Math.max(1, Math.round(w / 24) - (w > 30 ? 1 : 0));
  const seatW = (w - arm * 2 - 2) / seats;
  return (
    <>
      <Body w={w} h={h} fill={palette.accent} r={5} />
      <rect x={1.5} y={1.5} width={w - 3} height={h * 0.3} rx={4} fill={palette.accent} {...line} />
      {Array.from({ length: seats }, (_, i) => (
        <rect key={i} x={arm + 1 + i * seatW} y={h * 0.3} width={seatW} height={h * 0.62} rx={3} fill={palette.base} {...line} />
      ))}
      <rect x={1.5} y={h * 0.18} width={arm} height={h * 0.8} rx={3} fill={palette.accent} {...line} />
      <rect x={w - arm - 1.5} y={h * 0.18} width={arm} height={h * 0.8} rx={3} fill={palette.accent} {...line} />
    </>
  );
};

const armchair: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.accent} r={8} />
    <rect x={8} y={10} width={w - 16} height={h - 15} rx={5} fill={palette.base} {...line} />
    <path d={`M8 ${h * 0.45} H${w - 8} M8 ${h * 0.6} H${w - 8} M8 ${h * 0.75} H${w - 8}`} {...line} opacity={0.3} />
  </>
);

const bench: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={2} inset={3} />
    <path d={`M5 ${h / 2} H${w - 5}`} stroke={palette.accent} strokeWidth={1.2} />
  </>
);

const cushions: Draw = ({ palette }, { w, h }) => {
  const r = Math.min(w, h) * 0.24;
  return (
    <>
      <circle cx={w * 0.3} cy={h * 0.32} r={r} fill={palette.base} {...line} />
      <circle cx={w * 0.7} cy={h * 0.38} r={r} fill={palette.accent} {...line} />
      <circle cx={w * 0.45} cy={h * 0.72} r={r} fill={palette.detail ?? palette.base} {...line} />
    </>
  );
};

const officechair: Draw = ({ palette }, { w, h }) => {
  const cx = w / 2;
  const cy = h / 2 + 1;
  return (
    <>
      {[0, 72, 144, 216, 288].map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        return <path key={deg} d={`M${cx} ${cy} L${cx + Math.cos(rad) * 10} ${cy + Math.sin(rad) * 10}`} {...line} />;
      })}
      <circle cx={cx} cy={cy} r={7.5} fill={palette.base} {...line} />
      <path d={`M${cx - 8} ${cy - 6} Q${cx} ${cy - 13} ${cx + 8} ${cy - 6}`} fill="none" stroke={palette.accent} strokeWidth={3.5} strokeLinecap="round" />
    </>
  );
};

const lantern: Draw = ({ palette }, { w, h }) => (
  <>
    <circle cx={w / 2} cy={h / 2} r={6.5} fill={palette.base} {...line} />
    <circle cx={w / 2} cy={h / 2} r={3} fill={GLOW} {...line} />
    <path d={`M${w / 2 - 6} ${h / 2} Q${w / 2} ${h / 2 - 12} ${w / 2 + 6} ${h / 2}`} fill="none" stroke={palette.accent} strokeWidth={1.5} />
  </>
);

const floorlamp: Draw = ({ palette }, { w, h }) => (
  <>
    <circle cx={w / 2} cy={h / 2} r={8.5} fill={palette.base} {...line} />
    <circle cx={w / 2} cy={h / 2} r={4} fill={GLOW} stroke={palette.accent} strokeWidth={1} />
  </>
);

const solar: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h * 0.62} fill={palette.base} r={1} inset={3} />
    <path d={`M${w / 2} 3 V${h * 0.62 - 3} M3 ${h * 0.31} H${w - 3}`} stroke={palette.accent} strokeWidth={0.8} opacity={0.7} />
    <circle cx={w / 2} cy={h * 0.8} r={3.5} fill={palette.accent} {...line} />
  </>
);

const wardrobe: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={1} />
    <path d={`M${w / 2} 2 V${h - 2}`} stroke={palette.accent} strokeWidth={1.2} />
    <circle cx={w / 2 - 3} cy={h - 5} r={1.2} fill={GLOW} />
    <circle cx={w / 2 + 3} cy={h - 5} r={1.2} fill={GLOW} />
  </>
);

const fabricwardrobe: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={3} />
    <path d={`M3 3 L${w / 2} ${h / 2} L${w - 3} 3`} stroke={palette.accent} strokeWidth={1} fill="none" />
    <path d={`M${w / 2} ${h / 2} V${h - 2}`} stroke={palette.accent} strokeWidth={1} strokeDasharray="1.5 1.5" />
  </>
);

const bags: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={2} y={2} width={w - 6} height={h - 7} rx={2} fill={palette.base} {...line} />
    <rect x={5} y={6} width={w - 7} height={h - 8} rx={2} fill={palette.detail ?? LIGHT} {...line} />
    <path d={`M5 ${h * 0.45} H${w - 2} M5 ${h * 0.7} H${w - 2} M${w * 0.45} 6 V${h - 2} M${w * 0.72} 6 V${h - 2}`} stroke={palette.accent} strokeWidth={1.4} />
    <path d={`M5 ${h * 0.45} H${w - 2} M${w * 0.45} 6 V${h - 2}`} stroke={palette.base} strokeWidth={1.4} opacity={0.8} />
  </>
);

const drawers: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={1} />
    <path d={`M3 ${h - 4} H${w - 3}`} stroke={palette.accent} strokeWidth={1.4} />
    <circle cx={w * 0.25} cy={h * 0.4} r={2.5} fill={GLOW} {...line} />
  </>
);

const bookshelf: Draw = ({ palette }, { w, h }) => {
  const colours = [palette.accent, palette.detail ?? GLOW, GLOW, palette.accent, '#2E7D5B'];
  const count = Math.floor((w - 6) / 4.2);
  return (
    <>
      <Body w={w} h={h} fill={palette.base} r={1} />
      {Array.from({ length: count }, (_, i) => (
        <rect key={i} x={3.5 + i * 4.2} y={4 + (i % 3)} width={3.4} height={h - 9 - (i % 3)} fill={colours[i % colours.length]} stroke={OUTLINE} strokeWidth={0.5} />
      ))}
    </>
  );
};

const shoerack: Draw = ({ palette }, { w, h }) => {
  const pairs = Math.floor((w - 4) / 9);
  return (
    <>
      <Body w={w} h={h} fill={palette.base} r={1} />
      {Array.from({ length: pairs }, (_, i) => (
        <g key={i}>
          <ellipse cx={6 + i * 9} cy={h / 2} rx={1.8} ry={h * 0.3} fill={palette.accent} />
          <ellipse cx={9.5 + i * 9} cy={h / 2} rx={1.8} ry={h * 0.3} fill={palette.accent} />
        </g>
      ))}
    </>
  );
};

const cabinet: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={1} />
    <rect x={4} y={4} width={w - 8} height={h - 8} fill={palette.accent} opacity={0.85} stroke={OUTLINE} strokeWidth={0.6} />
    {[0.2, 0.4, 0.6, 0.8].map((f) => (
      <circle key={f} cx={w * f} cy={h / 2} r={2.2} fill={f === 0.4 || f === 0.8 ? '#C9A15A' : LIGHT} stroke={OUTLINE} strokeWidth={0.5} />
    ))}
  </>
);

const centretable: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={5} y={5} width={w - 10} height={h - 10} rx={4} fill={palette.base} opacity={0.9} stroke={palette.accent} strokeWidth={2.4} />
    <rect x={5} y={5} width={w - 10} height={h - 10} rx={4} fill="none" {...line} />
    <path d={`M10 10 L16 16`} stroke={LIGHT} strokeWidth={1.5} strokeLinecap="round" />
    <circle cx={w * 0.62} cy={h * 0.58} r={3.5} fill="#2E7D5B" {...line} />
  </>
);

const stool: Draw = ({ palette }, { w, h }) => (
  <>
    <circle cx={w / 2} cy={h / 2} r={7.5} fill={palette.base} {...line} />
    <circle cx={w / 2} cy={h / 2} r={4.5} fill="none" stroke={palette.accent} strokeWidth={1} />
  </>
);

const dining: Draw = ({ palette }, { w, h }) => {
  const tx = w * 0.24;
  const ty = h * 0.3;
  const tw = w * 0.52;
  const th = h * 0.4;
  const chair = (x: number, y: number, key: string) => (
    <rect key={key} x={x - 5} y={y - 5} width={10} height={10} rx={2} fill={palette.accent} {...line} />
  );
  return (
    <>
      {chair(w * 0.37, ty - 4, 'a')}
      {chair(w * 0.63, ty - 4, 'b')}
      {chair(w * 0.37, ty + th + 4, 'c')}
      {chair(w * 0.63, ty + th + 4, 'd')}
      <rect x={tx} y={ty} width={tw} height={th} rx={2} fill={palette.base} {...line} />
      <ellipse cx={w / 2} cy={h / 2} rx={5} ry={3} fill={LIGHT} {...line} />
    </>
  );
};

const desk: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={1} />
    <rect x={w * 0.3} y={4} width={w * 0.4} height={h - 9} rx={1} fill={palette.accent} {...line} />
    <path d={`M${w * 0.3} ${h - 7} H${w * 0.7}`} stroke={GLOW} strokeWidth={0.8} />
  </>
);

const workstation: Draw = ({ palette }, { w, h }) => {
  const d = h * 0.45;
  return (
    <>
      <path
        d={`M1.5 1.5 H${w - 1.5} V${h - 1.5} H${w - d} V${d} H1.5 Z`}
        fill={palette.base}
        {...line}
      />
      <rect x={w * 0.2} y={3.5} width={w * 0.34} height={3} rx={1} fill={palette.accent} {...line} />
      <rect x={w * 0.58} y={3.5} width={w * 0.24} height={3} rx={1} fill={palette.accent} {...line} />
      <rect x={w * 0.32} y={d * 0.55} width={w * 0.18} height={4} rx={1} fill={LIGHT} {...line} />
      <circle cx={w - d / 2} cy={h * 0.75} r={3} fill="#2E7D5B" {...line} />
    </>
  );
};

const tvstand: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={1} />
    <rect x={w * 0.12} y={4} width={w * 0.76} height={3.5} rx={1} fill={palette.accent} {...line} />
    <path d={`M${w / 2} 7.5 V${h * 0.62}`} {...line} />
    <rect x={w * 0.42} y={h * 0.55} width={w * 0.16} height={3} rx={1} fill={palette.accent} />
  </>
);

const smalltv: Draw = ({ palette }, { w, h }) => (
  <>
    <circle cx={w / 2} cy={h / 2 + 1} r={8} fill={palette.base} {...line} />
    <rect x={w * 0.18} y={5} width={w * 0.64} height={4} rx={1} fill={palette.accent} {...line} />
  </>
);

const speaker: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={3} inset={3} />
    <circle cx={w / 2} cy={h / 2} r={5.5} fill={OUTLINE} stroke={palette.accent} strokeWidth={1.4} />
    <circle cx={w / 2} cy={h / 2} r={1.8} fill={palette.accent} />
  </>
);

const gen: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={2.5} y={2.5} width={w - 5} height={h - 5} rx={1} fill="none" stroke={OUTLINE} strokeWidth={1.6} />
    <rect x={5} y={5} width={w - 10} height={h - 10} rx={2} fill={palette.base} {...line} />
    <rect x={7.5} y={8} width={w - 15} height={5} rx={1} fill={palette.accent} />
  </>
);

const jerrycan: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={4} y={3} width={w - 8} height={h - 6} rx={2} fill={palette.base} {...line} />
    <path d={`M7 7 H${w - 11} M7 10 H${w - 11}`} stroke={palette.accent} strokeWidth={1.2} />
    <circle cx={w - 7.5} cy={6.5} r={2.2} fill={palette.accent} {...line} />
    <path d={`M7 ${h - 8} L${w - 7} 13`} stroke={palette.accent} strokeWidth={1} opacity={0.6} />
  </>
);

const inverter: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={1.5} y={1.5} width={w * 0.45} height={h - 3} rx={2} fill={palette.base} {...line} />
    <circle cx={w * 0.12} cy={h / 2} r={1.6} fill={palette.accent} />
    <rect x={w * 0.52} y={2.5} width={w * 0.46} height={h - 5} rx={1.5} fill="#2A2E38" {...line} />
    <path d={`M${w * 0.62} 6 V${h - 6} M${w * 0.88} 6 V${h - 6}`} stroke="#C2452D" strokeWidth={1.4} />
  </>
);

const fan: Draw = ({ palette }, { w, h }) => {
  const cx = w / 2;
  const cy = h / 2;
  return (
    <>
      <circle cx={cx} cy={cy} r={9} fill={palette.base} {...line} />
      {[0, 120, 240].map((deg) => (
        <ellipse key={deg} cx={cx} cy={cy - 4.2} rx={2.4} ry={4} fill={palette.accent} transform={`rotate(${deg} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={1.8} fill={OUTLINE} />
      <circle cx={cx} cy={cy} r={9} fill="none" stroke={OUTLINE} strokeWidth={0.5} strokeDasharray="1 1.6" />
    </>
  );
};

const cooler: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={3} y={3.5} width={w - 6} height={h - 7} rx={5} fill={palette.base} {...line} />
    <rect x={6} y={6.5} width={w - 12} height={h - 13} rx={3} fill={palette.accent} {...line} />
    <path d={`M${w / 2 - 4} ${h / 2} H${w / 2 + 4}`} stroke={palette.base} strokeWidth={2} strokeLinecap="round" />
  </>
);

const fridge: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={2} inset={2.5} />
    <path d={`M${w - 7} ${h - 4.5} H${w - 13}`} stroke={palette.accent} strokeWidth={2} strokeLinecap="round" />
  </>
);

const mirror: Draw = ({ palette }, { w, h }) => (
  <>
    {/* Feet of the stand, behind the glass. */}
    <circle cx={4.5} cy={4.5} r={1.6} fill={palette.accent} />
    <circle cx={w - 4.5} cy={4.5} r={1.6} fill={palette.accent} />
    {/* Framed glass with a diagonal shine, seen from above at a slight tilt. */}
    <rect x={2} y={6} width={w - 4} height={h - 10} rx={2} fill={palette.accent} {...line} />
    <rect x={4} y={8} width={w - 8} height={h - 14} rx={1} fill={palette.base} />
    <path
      d={`M${w * 0.3} ${h - 7} L${w * 0.55} 9 M${w * 0.5} ${h - 7} L${w * 0.72} 9`}
      stroke={LIGHT}
      strokeWidth={1.4}
      strokeLinecap="round"
    />
  </>
);

const plant: Draw = ({ palette }, { w, h }) => {
  const cx = w / 2;
  const cy = h / 2;
  return (
    <>
      <circle cx={cx} cy={cy} r={6} fill={palette.accent} {...line} />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <path
          key={deg}
          d={`M${cx} ${cy} Q${cx + 3} ${cy - 5} ${cx} ${cy - 10} Q${cx - 3} ${cy - 5} ${cx} ${cy}`}
          fill={palette.base}
          {...line}
          strokeWidth={0.7}
          transform={`rotate(${deg} ${cx} ${cy})`}
        />
      ))}
    </>
  );
};

const pouf: Draw = ({ palette }, { w, h }) => (
  <>
    <circle cx={w / 2} cy={h / 2} r={8} fill={palette.base} {...line} />
    <circle cx={w / 2} cy={h / 2} r={4.5} fill="none" stroke={palette.accent} strokeWidth={1.2} />
    <circle cx={w / 2} cy={h / 2} r={1.2} fill={palette.accent} />
  </>
);

const mat: Draw =({ palette }, { w, h }) => (
  <>
    <rect x={2} y={2} width={w - 4} height={h - 4} rx={1} fill={palette.base} stroke={palette.accent} strokeWidth={1} />
    {Array.from({ length: Math.floor((w - 6) / 5) }, (_, i) => (
      <path key={i} d={`M${5 + i * 5} 3 V${h - 3}`} stroke={palette.accent} strokeWidth={0.8} opacity={0.6} />
    ))}
    <path d={`M2 ${h - 2} m0 0 h-1.5 M${w - 2} ${h - 2} h1.5`} stroke={palette.accent} />
  </>
);

const rug: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={2} y={2} width={w - 4} height={h - 4} rx={2} fill={palette.base} stroke={palette.accent} strokeWidth={1.2} />
    <rect x={6} y={6} width={w - 12} height={h - 12} rx={1} fill="none" stroke={palette.accent} strokeWidth={1.6} />
    <path
      d={`M${w / 2} ${h * 0.25} L${w * 0.72} ${h / 2} L${w / 2} ${h * 0.75} L${w * 0.28} ${h / 2} Z`}
      fill={palette.detail ?? palette.accent}
      opacity={0.75}
    />
    <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) * 0.07} fill={palette.accent} />
  </>
);

// Wall-mounted. The wall line is y = 0; these hang across it.

const sconce: Draw = ({ palette }, { w }) => (
  <>
    {[w * 0.2, w * 0.8].map((x) => (
      <g key={x}>
        <circle cx={x} cy={3} r={6} fill={palette.accent} opacity={0.55} />
        <path d={`M${x - 4} 0 A4 4 0 0 0 ${x + 4} 0 Z`} fill={palette.base} {...line} />
      </g>
    ))}
  </>
);

const bracket: Draw = ({ palette }, { w }) => (
  <>
    <circle cx={w / 2} cy={3} r={5.5} fill={palette.accent} opacity={0.6} />
    <path d={`M${w / 2 - 4} 0 A4 4 0 0 0 ${w / 2 + 4} 0 Z`} fill={palette.base} {...line} />
  </>
);

const walltv: Draw = ({ palette }, { w }) => (
  <>
    <rect x={2} y={-1.5} width={w - 4} height={4.5} rx={1} fill={palette.base} {...line} />
    <path d={`M5 1 H${w * 0.4}`} stroke={palette.accent} strokeWidth={1} opacity={0.8} />
  </>
);

const meter: Draw = ({ palette }, { w }) => (
  <>
    <rect x={w / 2 - 6} y={-3} width={12} height={8} rx={1.5} fill={palette.base} {...line} />
    <rect x={w / 2 - 4} y={-1.5} width={8} height={3} fill={palette.accent} />
  </>
);

const ac: Draw = ({ palette }, { w }) => (
  <>
    <rect x={3} y={-3} width={w - 6} height={7.5} rx={3} fill={palette.base} {...line} />
    <path d={`M7 2 H${w - 7}`} stroke={palette.accent} strokeWidth={1} />
    <circle cx={w - 8} cy={-0.5} r={0.9} fill="#2E7D5B" />
  </>
);

const clock: Draw = ({ palette }, { w }) => (
  <>
    <circle cx={w / 2} cy={1} r={5} fill={palette.base} {...line} />
    <path d={`M${w / 2} 1 V-2.2 M${w / 2} 1 H${w / 2 + 2.4}`} stroke={palette.accent} strokeWidth={0.9} strokeLinecap="round" />
  </>
);

const frames: Draw = ({ palette }, { w }) => (
  <>
    {[0.25, 0.55, 0.8].map((f, i) => (
      <g key={f}>
        <rect x={w * f - 4} y={-3 + (i % 2)} width={8} height={6} fill={palette.base} {...line} strokeWidth={0.8} />
        <rect x={w * f - 2} y={-1.5 + (i % 2)} width={4} height={3} fill={palette.accent} />
      </g>
    ))}
  </>
);

const art: Draw = ({ palette }, { w }) => (
  <>
    <rect x={w * 0.2} y={-3} width={w * 0.6} height={7} fill={palette.base} {...line} />
    {[0.32, 0.5, 0.68].map((f) => (
      <circle key={f} cx={w * f} cy={0.5} r={1.6} fill="none" stroke={palette.accent} strokeWidth={0.8} />
    ))}
  </>
);

const calendar: Draw = ({ palette }, { w }) => (
  <>
    <rect x={w / 2 - 4.5} y={-3} width={9} height={8} fill={palette.base} {...line} strokeWidth={0.8} />
    <rect x={w / 2 - 4.5} y={-3} width={9} height={2.5} fill={palette.accent} />
  </>
);

const curtain: Draw = ({ palette }, { w }) => {
  const folds = Math.max(3, Math.round(w / 6));
  const step = w / folds;
  let d = `M0 0`;
  for (let i = 0; i < folds; i++) d += ` Q${step * i + step / 2} 7 ${step * (i + 1)} 0`;
  return (
    <>
      <path d={`${d} V-2 H0 Z`} fill={palette.base} {...line} strokeWidth={0.9} />
      <path d={`M-1 -2.5 H${w + 1}`} stroke={palette.accent} strokeWidth={2} strokeLinecap="round" />
    </>
  );
};

const blinds: Draw = ({ palette }, { w }) => (
  <>
    <rect x={0} y={-2} width={w} height={5} fill={palette.base} {...line} strokeWidth={0.9} />
    <path d={`M1 0.5 H${w - 1}`} stroke={palette.accent} strokeWidth={0.8} />
  </>
);

// Confirmed game items ---------------------------------------------------------
// Bespoke top-down drawings for every verified Sleep, Kitchen, Bath and Comfort
// item, each with its own palette.

function Pillow({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) * 0.35} fill={LIGHT} {...line} />;
}

const foamMattress: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={4} />
    {[0.3, 0.42, 0.54].map((f) => (
      <circle key={f} cx={w * 0.3} cy={h * f} r={0.9} fill={palette.detail} />
    ))}
    {[0.36, 0.48].map((f) => (
      <circle key={f} cx={w * 0.7} cy={h * f} r={0.9} fill={palette.detail} />
    ))}
    <Pillow x={4} y={4} w={w - 8} h={h * 0.15} />
    <rect x={2.5} y={h * 0.62} width={w - 5} height={h * 0.38 - 4} rx={3} fill={palette.accent} {...line} />
    <path d={`M5 ${h * 0.7} H${w - 5}`} stroke={LIGHT} strokeWidth={1} opacity={0.6} />
  </>
);

const springBed: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={1.5} y={1.5} width={w - 3} height={h - 3} rx={2} fill="none" stroke={palette.base} strokeWidth={2.4} />
    <rect x={3.5} y={3.5} width={w - 7} height={h - 7} rx={3} fill={palette.accent} {...line} />
    <Pillow x={5.5} y={6} w={w - 11} h={h * 0.14} />
    <rect x={3.5} y={h * 0.5} width={w - 7} height={h * 0.5 - 3.5} rx={3} fill={palette.detail} {...line} />
    <path d={`M3.5 ${h * 0.58} H${w - 3.5}`} stroke={LIGHT} strokeWidth={1.2} opacity={0.7} />
  </>
);

const bunkBed: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={2} />
    <rect x={4} y={4} width={w - 8} height={h - 8} rx={2} fill={palette.accent} {...line} />
    <Pillow x={6} y={6.5} w={w - 12} h={h * 0.13} />
    <rect x={4} y={h * 0.55} width={w - 8} height={h * 0.45 - 4} rx={2} fill={palette.detail} {...line} />
    {[1.5, w - 5.5].map((x) =>
      [1.5, h - 5.5].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} fill={palette.base} {...line} />),
    )}
    {[0.3, 0.42, 0.54].map((f) => (
      <path key={f} d={`M${w - 4} ${h * f} H${w - 1.5}`} stroke={OUTLINE} strokeWidth={1.2} />
    ))}
  </>
);

const kingBed: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={3} />
    <rect x={1.5} y={1.5} width={w - 3} height={8} rx={3} fill={palette.base} {...line} />
    <rect x={4} y={10} width={w - 8} height={h - 14} rx={3} fill={palette.accent} {...line} />
    <Pillow x={7} y={13} w={w / 2 - 9} h={h * 0.13} />
    <Pillow x={w / 2 + 2} y={13} w={w / 2 - 9} h={h * 0.13} />
    <rect x={4} y={h * 0.48} width={w - 8} height={h * 0.52 - 4} rx={3} fill={palette.detail} {...line} />
    <path d={`M4 ${h * 0.56} H${w - 4}`} stroke={LIGHT} strokeWidth={1.6} opacity={0.8} />
  </>
);

const slidingWardrobe: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.accent} r={1.5} />
    {/* Two sliding doors on their tracks, the front one overlapping the back. */}
    <rect x={3} y={h * 0.38} width={w * 0.55} height={h * 0.5} fill={palette.base} {...line} />
    <rect x={w * 0.42} y={h * 0.5} width={w * 0.58 - 3} height={h * 0.42} fill={palette.base} {...line} />
    <path d={`M${w * 0.36} ${h * 0.48} V${h * 0.78} M${w * 0.64} ${h * 0.6} V${h * 0.84}`} stroke={palette.detail} strokeWidth={1.6} strokeLinecap="round" />
    <path d={`M3 ${h * 0.3} H${w - 3}`} stroke={palette.detail} strokeWidth={0.8} opacity={0.5} />
  </>
);

const queenBed: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={4} />
    <path d={`M2 11 Q${w / 2} 0 ${w - 2} 11 Z`} fill={palette.base} {...line} />
    {[0.25, 0.5, 0.75].map((f) => (
      <circle key={f} cx={w * f} cy={6.5} r={1} fill={OUTLINE} opacity={0.45} />
    ))}
    <rect x={4.5} y={11} width={w - 9} height={h - 15} rx={3} fill={palette.accent} {...line} />
    <Pillow x={7} y={14} w={w / 2 - 9} h={h * 0.13} />
    <Pillow x={w / 2 + 2} y={14} w={w / 2 - 9} h={h * 0.13} />
    <rect x={4.5} y={h * 0.5} width={w - 9} height={h * 0.5 - 4} rx={3} fill={palette.detail} {...line} />
    <rect x={4.5} y={h * 0.5} width={w - 9} height={5} fill={LIGHT} opacity={0.8} />
  </>
);

const fourPoster: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={4} y={4} width={w - 8} height={h - 8} rx={2} fill={palette.accent} {...line} />
    <Pillow x={8} y={8} w={w / 2 - 10} h={h * 0.13} />
    <Pillow x={w / 2 + 2} y={8} w={w / 2 - 10} h={h * 0.13} />
    <rect x={4} y={h * 0.5} width={w - 8} height={h * 0.5 - 4} rx={2} fill={palette.detail} {...line} />
    <rect x={4} y={4} width={w - 8} height={h - 8} rx={2} fill="none" stroke={LIGHT} strokeWidth={1.6} strokeDasharray="3 2" opacity={0.9} />
    {[4, w - 4].map((x) => [4, h - 4].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={3.2} fill={palette.base} {...line} />))}
  </>
);

const walkInCloset: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={2} />
    <rect x={4} y={3.5} width={w - 8} height={h - 7} rx={1.5} fill={palette.accent} opacity={0.95} />
    <path d={`M5 7 H${w - 5}`} stroke={palette.detail} strokeWidth={1.4} />
    {Array.from({ length: Math.floor((w - 12) / 4) }, (_, i) => (
      <rect key={i} x={7 + i * 4} y={8} width={2.6} height={h - 14} rx={1} fill={['#B5523B', '#3D5A99', '#2E7D5B', '#D29A3A', '#6F5E92'][i % 5]} />
    ))}
    <rect x={4} y={3.5} width={w - 8} height={h - 7} rx={1.5} fill="none" stroke={palette.detail} strokeWidth={1} />
  </>
);

const roundBed: Draw = ({ palette }, { w, h }) => {
  const r = Math.min(w, h) / 2 - 1.5;
  const cx = w / 2;
  const cy = h / 2;
  const inner = r - 4;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={palette.base} {...line} />
      <circle cx={cx} cy={cy} r={inner} fill={palette.accent} {...line} />
      <path d={`M${cx - inner} ${cy + 2} A${inner} ${inner} 0 0 0 ${cx + inner} ${cy + 2} Z`} fill={palette.detail} {...line} />
      <ellipse cx={cx - 7} cy={cy - r * 0.45} rx={6} ry={3.6} fill={LIGHT} {...line} />
      <ellipse cx={cx + 7} cy={cy - r * 0.45} rx={6} ry={3.6} fill={LIGHT} {...line} />
      <path d={`M${cx + r - 1} ${cy - 6} A${r - 1} ${r - 1} 0 0 1 ${cx + r - 6} ${cy + 10}`} fill="none" stroke={palette.detail} strokeWidth={1.4} />
    </>
  );
};

const coolerBox: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={3} y={4} width={w - 6} height={h - 8} rx={4} fill={palette.base} {...line} />
    <rect x={5} y={6} width={w - 10} height={h - 12} rx={3} fill={palette.accent} {...line} />
    <rect x={w / 2 - 5} y={h / 2 - 1.5} width={10} height={3} rx={1.5} fill={palette.base} />
  </>
);

const keroseneStove: Draw = ({ palette }, { w, h }) => (
  <>
    <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 2} fill={palette.base} {...line} />
    <circle cx={w / 2} cy={h / 2} r={6} fill={palette.accent} {...line} />
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return <circle key={i} cx={w / 2 + Math.cos(a) * 4} cy={h / 2 + Math.sin(a) * 4} r={0.9} fill={palette.detail} />;
    })}
    <path d={`M${w / 2 - 8} ${h / 2} H${w / 2 - 6} M${w / 2 + 6} ${h / 2} H${w / 2 + 8}`} stroke={OUTLINE} strokeWidth={1.4} />
  </>
);

const kitchenCounter: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={1.5} />
    <rect x={1.5} y={h - 5} width={w - 3} height={3.5} fill={palette.accent} {...line} />
    <rect x={5} y={6} width={10} height={7} rx={1.5} fill={palette.detail} {...line} />
    <circle cx={w - 6.5} cy={8} r={2} fill={LIGHT} {...line} />
  </>
);

const airFryer: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={3.5} y={3.5} width={w - 7} height={h - 7} rx={6} fill={palette.base} {...line} />
    <circle cx={w / 2} cy={h / 2 - 1} r={4.5} fill="none" stroke={palette.accent} strokeWidth={1.4} />
    <circle cx={w / 2} cy={h / 2 - 1} r={1.4} fill={palette.accent} />
    <rect x={w / 2 - 4} y={h - 7} width={8} height={2} rx={1} fill={palette.accent} />
  </>
);

const chestFreezer: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={2} />
    <path d={`M3 ${h - 7} H${w - 3}`} stroke={palette.accent} strokeWidth={1.2} />
    <rect x={w / 2 - 4} y={h - 6} width={8} height={2.2} rx={1} fill={palette.accent} />
    <circle cx={5.5} cy={5.5} r={1.2} fill={palette.detail} />
  </>
);

const marbleIsland: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={2} y={2} width={w - 4} height={h - 4} rx={2} fill={palette.base} stroke={palette.detail} strokeWidth={1.6} />
    <rect x={2} y={2} width={w - 4} height={h - 4} rx={2} fill="none" {...line} />
    <path
      d={`M4 ${h * 0.35} C${w * 0.35} ${h * 0.2}, ${w * 0.55} ${h * 0.6}, ${w - 4} ${h * 0.45} M${w * 0.3} ${h - 4} C${w * 0.4} ${h * 0.7}, ${w * 0.6} ${h * 0.75}, ${w * 0.7} ${h * 0.55}`}
      fill="none"
      stroke={palette.accent}
      strokeWidth={0.8}
    />
  </>
);

const BURNERS: [number, number, number][] = [
  [0.3, 0.3, 3.2],
  [0.7, 0.3, 3.2],
  [0.3, 0.68, 3.2],
  [0.7, 0.68, 3.2],
  [0.5, 0.49, 2.2],
];

const cookerOven: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={1.5} />
    {BURNERS.map(([fx, fy, r]) => (
      <circle key={`${fx}-${fy}`} cx={w * fx} cy={h * fy} r={r} fill={palette.accent} stroke={palette.detail} strokeWidth={0.8} />
    ))}
    <path d={`M4 ${h - 2.8} H${w - 4}`} stroke={palette.accent} strokeWidth={1.2} strokeDasharray="1.5 2.5" />
  </>
);

const bucketBowl: Draw = ({ palette }, { w, h }) => (
  <>
    <circle cx={w * 0.42} cy={h * 0.45} r={7.5} fill={palette.base} {...line} />
    <circle cx={w * 0.42} cy={h * 0.45} r={5.2} fill="#9CC3EE" />
    <path d={`M${w * 0.42 - 7.5} ${h * 0.45} A7.5 7.5 0 0 1 ${w * 0.42 + 7.5} ${h * 0.45}`} fill="none" stroke={OUTLINE} strokeWidth={0.9} opacity={0.6} />
    <circle cx={w * 0.74} cy={h * 0.76} r={4} fill={palette.accent} {...line} />
  </>
);

const waterDrum: Draw = ({ palette }, { w, h }) => (
  <>
    <circle cx={w * 0.42} cy={h * 0.44} r={8.5} fill={palette.base} {...line} />
    <circle cx={w * 0.42} cy={h * 0.44} r={3} fill="#24498A" />
    <rect x={w * 0.62} y={h * 0.6} width={7} height={8} rx={1.5} fill={palette.accent} {...line} />
    <rect x={w * 0.66} y={h * 0.56} width={2.4} height={2.4} fill={palette.accent} stroke={OUTLINE} strokeWidth={0.8} />
  </>
);

const wcToilet: Draw = ({ palette }, { w, h }) => (
  <>
    <rect x={4} y={2} width={w - 8} height={6} rx={1.5} fill={palette.base} {...line} />
    <ellipse cx={w / 2} cy={h * 0.6} rx={7} ry={8.5} fill={palette.base} {...line} />
    <ellipse cx={w / 2} cy={h * 0.62} rx={4} ry={5.2} fill={palette.accent} />
    <circle cx={w - 7} cy={5} r={1} fill={palette.accent} />
  </>
);

const rainShower: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={2} />
    <circle cx={w / 2} cy={h / 2} r={6.5} fill={palette.accent} stroke={OUTLINE} strokeWidth={0.9} />
    {Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2;
      return <circle key={i} cx={w / 2 + Math.cos(a) * 3.6} cy={h / 2 + Math.sin(a) * 3.6} r={0.7} fill={palette.detail} />;
    })}
    <circle cx={w / 2} cy={h / 2} r={0.9} fill={palette.detail} />
  </>
);

const bathtub: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={5} />
    <rect x={5} y={4.5} width={w - 10} height={h - 9} rx={(h - 9) * 0.45} fill={palette.accent} stroke={OUTLINE} strokeWidth={0.9} />
    <circle cx={w * 0.78} cy={h / 2} r={1.2} fill={OUTLINE} opacity={0.5} />
    <rect x={w / 2 - 2} y={1.5} width={4} height={4} rx={1} fill="#9AA3AE" stroke={OUTLINE} strokeWidth={0.8} />
  </>
);

const washingMachine: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={2} />
    <rect x={3.5} y={3.5} width={w - 7} height={4} rx={1} fill={palette.detail} opacity={0.15} />
    <circle cx={w - 7} cy={5.5} r={1.1} fill={palette.detail} />
    <circle cx={w / 2} cy={h * 0.6} r={6} fill={palette.accent} stroke={palette.detail} strokeWidth={1.4} />
    <path d={`M${w / 2 - 3} ${h * 0.58} Q${w / 2} ${h * 0.5} ${w / 2 + 3} ${h * 0.58}`} fill="none" stroke={LIGHT} strokeWidth={1} />
  </>
);

const BUBBLES: [number, number, number][] = [
  [0.35, 0.35, 1.6],
  [0.6, 0.42, 1.1],
  [0.45, 0.6, 1.3],
  [0.66, 0.66, 1.8],
  [0.3, 0.68, 0.9],
];

const jacuzzi: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={6} />
    <rect x={6} y={6} width={w - 12} height={h - 12} rx={(w - 12) * 0.3} fill={palette.accent} stroke={OUTLINE} strokeWidth={0.9} />
    {BUBBLES.map(([fx, fy, r]) => (
      <circle key={`${fx}-${fy}`} cx={w * fx} cy={h * fy} r={r} fill={palette.detail} opacity={0.85} />
    ))}
    <circle cx={6} cy={h / 2} r={1.4} fill="#9AA3AE" />
    <circle cx={w - 6} cy={h / 2} r={1.4} fill="#9AA3AE" />
    <circle cx={w / 2} cy={6} r={1.4} fill="#9AA3AE" />
  </>
);

const loungeArmchair: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.accent} r={5} />
    <rect x={5} y={7} width={w - 10} height={h - 10} rx={3} fill={palette.base} {...line} />
  </>
);

const velvetSofa: Draw = ({ palette }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.accent} r={5} />
    <rect x={7} y={h * 0.32} width={(w - 14) / 2} height={h * 0.6} rx={3} fill={palette.base} {...line} />
    <rect x={w / 2} y={h * 0.32} width={(w - 14) / 2} height={h * 0.6} rx={3} fill={palette.base} {...line} />
    <path d={`M10 ${h * 0.22} H${w - 10}`} stroke={LIGHT} strokeWidth={1} opacity={0.35} />
  </>
);

const beanBag: Draw = ({ palette }, { w, h }) => (
  <>
    <path
      d={`M${w * 0.5} 2.5 C${w * 0.9} 2.5, ${w - 2} ${h * 0.35}, ${w - 3} ${h * 0.6} C${w - 4} ${h - 2}, ${w * 0.25} ${h - 2}, 3 ${h * 0.7} C2 ${h * 0.4}, ${w * 0.2} 2.5, ${w * 0.5} 2.5 Z`}
      fill={palette.base}
      {...line}
    />
    <ellipse cx={w * 0.52} cy={h * 0.55} rx={5} ry={4} fill={palette.accent} opacity={0.75} />
  </>
);

/** Confirmed items by catalogue id, with the palette each is drawn in. */
const VERIFIED_ART: Record<string, { draw: Draw; palette: Palette }> = {
  'foam-mattress': { draw: foamMattress, palette: { base: '#E3D9BF', accent: '#4F6FA8', detail: '#B9AC88' } },
  'spring-bed': { draw: springBed, palette: { base: '#3B4252', accent: '#C9D6EA', detail: '#5B78B5' } },
  'bunk-bed': { draw: bunkBed, palette: { base: '#8A5A34', accent: '#D7E0F0', detail: '#B5523B' } },
  'lekki-king-bed': { draw: kingBed, palette: { base: '#2B2F3A', accent: '#F4F0E8', detail: '#2F6B5E' } },
  'sliding-wardrobe': { draw: slidingWardrobe, palette: { base: '#E8E2D6', accent: '#B9AE98', detail: '#3A3F47' } },
  'upholstered-queen-bed': { draw: queenBed, palette: { base: '#C7A6B8', accent: '#F4F0E8', detail: '#E7C9CF' } },
  'four-poster-canopy-bed': { draw: fourPoster, palette: { base: '#5A3A22', accent: '#F4F0E8', detail: '#C9A15A' } },
  'walk-in-closet-display': { draw: walkInCloset, palette: { base: '#2B2F3A', accent: '#F4F0E8', detail: '#D29A3A' } },
  'rotating-round-bed': { draw: roundBed, palette: { base: '#3A2E5C', accent: '#F4F0E8', detail: '#C9A15A' } },
  'cooler-box': { draw: coolerBox, palette: { base: '#2F5EA8', accent: '#F2F2F2' } },
  'kerosene-stove': { draw: keroseneStove, palette: { base: '#3B6E8F', accent: '#2A2E38', detail: '#E0B32E' } },
  'kitchen-counter': { draw: kitchenCounter, palette: { base: '#D9CBB2', accent: '#8A6440', detail: '#C49A6C' } },
  'air-fryer': { draw: airFryer, palette: { base: '#22262E', accent: '#D29A3A' } },
  'chest-deep-freezer': { draw: chestFreezer, palette: { base: '#EEF1F4', accent: '#9AA3AE', detail: '#2E7D5B' } },
  'marble-kitchen-island': { draw: marbleIsland, palette: { base: '#F2F0EC', accent: '#C9C5BC', detail: '#D29A3A' } },
  'five-burner-cooker-oven': { draw: cookerOven, palette: { base: '#C8CCD2', accent: '#2A2E38', detail: '#E7EAEE' } },
  'bucket-and-bowl': { draw: bucketBowl, palette: { base: '#3D7DD8', accent: '#F2B33D' } },
  'water-drum-jerrycans': { draw: waterDrum, palette: { base: '#2F5EA8', accent: '#E0B32E' } },
  'wc-toilet': { draw: wcToilet, palette: { base: '#F7F7F4', accent: '#C9D3DA' } },
  'rain-shower': { draw: rainShower, palette: { base: '#DDE7EC', accent: '#9DB7C9', detail: '#5D6B78' } },
  bathtub: { draw: bathtub, palette: { base: '#F7F7F4', accent: '#BFDCE6' } },
  'washing-machine': { draw: washingMachine, palette: { base: '#F2F3F5', accent: '#9DB7C9', detail: '#2A2E38' } },
  jacuzzi: { draw: jacuzzi, palette: { base: '#E8E2D6', accent: '#7FC4D9', detail: '#F7F7F4' } },
  'plastic-chair': { draw: plasticchair, palette: { base: '#F7F6F1', accent: '#9AA0AA' } },
  'standing-fan': { draw: fan, palette: { base: '#E9EBEF', accent: '#3D5A99' } },
  'dining-table': { draw: dining, palette: { base: '#8A5A34', accent: '#C9A15A' } },
  'lounge-armchair': { draw: loungeArmchair, palette: { base: '#A0714A', accent: '#7C5534' } },
  'velvet-sofa': { draw: velvetSofa, palette: { base: '#8A3354', accent: '#6A2440' } },
  'bean-bag': { draw: beanBag, palette: { base: '#D98E3A', accent: '#B36F28' } },
};

/** A plain block for anything without a drawing yet. */
const generic: Draw = ({ palette, initial }, { w, h }) => (
  <>
    <Body w={w} h={h} fill={palette.base} r={3} />
    <rect x={4} y={4} width={Math.max(1, w - 8)} height={Math.max(1, h * 0.28)} rx={2} fill={palette.accent} />
    <text x={w / 2} y={h * 0.72} textAnchor="middle" fontSize={Math.min(w, h) * 0.38} fontWeight={700} fill={OUTLINE} opacity={0.7}>
      {initial}
    </text>
  </>
);

const drawings: Record<SpriteKind, Draw> = {
  generic,
  mattress, campbed, bed,
  plasticchair, sofa, armchair, bench, cushions, officechair,
  lantern, floorlamp, solar, sconce, bracket,
  wardrobe, fabricwardrobe, bags, drawers, bookshelf, shoerack, cabinet,
  centretable, stool, dining,
  desk, workstation,
  tvstand, smalltv, speaker, walltv,
  gen, jerrycan, inverter, meter,
  fan, ac,
  cooler, fridge,
  mirror, plant, pouf, clock, frames, art, calendar,
  mat, rug,
  curtain, blinds,
};

const CATEGORY_PALETTES: Record<CatalogueItem['category'], Palette> = {
  Design: { base: '#D9C7A3', accent: '#8A6440' },
  Sleep: { base: '#ECE6F2', accent: '#5B78B5', detail: '#8A5A34' },
  Kitchen: { base: '#DCE0E6', accent: '#7D8593' },
  Bath: { base: '#E4EEF2', accent: '#6E9CB5' },
  Comfort: { base: '#A0714A', accent: '#7C5534' },
  Fun: { base: '#3B3F48', accent: '#C2452D' },
  Skills: { base: '#C49A6C', accent: '#3A3F4A' },
  Light: { base: '#EBD9A4', accent: '#6B5B3E' },
  Decor: { base: '#C7B9D8', accent: '#6F5E92', detail: '#2E7D5B' },
  Pets: { base: '#B5835A', accent: '#5C3920' },
  Luxury: { base: '#C9A15A', accent: '#4B3F72', detail: '#F4F0E8' },
};

const PLANT_PALETTE: Palette = { base: '#3F8F5E', accent: '#B5523B' };

/** Picks a drawing for an item from what it is and what it's called. */
function kindFor(item: CatalogueItem): SpriteKind {
  const name = item.name.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(name);
  const wall = item.placement === 'wallmount';
  switch (roleOf(item)) {
    case 'bed':
      return has(/mattress/) ? 'mattress' : has(/bunk/) ? 'campbed' : 'bed';
    case 'storage':
      return has(/wardrobe|closet/) ? 'wardrobe' : has(/basket/) ? 'bags' : has(/shelf/) ? 'bookshelf' : 'drawers';
    case 'seat':
      return has(/plastic/) ? 'plasticchair' : has(/sofa/) ? 'sofa' : has(/bench/) ? 'bench' : has(/bean|pouf/) ? 'pouf' : 'armchair';
    case 'table':
      return has(/dining/) ? 'dining' : 'centretable';
    case 'light':
      return wall ? 'sconce' : has(/lantern/) ? 'lantern' : has(/solar|flood/) ? 'solar' : 'floorlamp';
    case 'cooling':
      return 'fan';
    case 'cold':
      return has(/cooler/) ? 'cooler' : 'fridge';
    case 'wash':
      return has(/drum|jerry/) ? 'jerrycan' : 'generic';
    case 'desk':
      return has(/workstation|computer/) ? 'workstation' : has(/shelf/) ? 'bookshelf' : 'desk';
    case 'screen':
      return wall ? 'walltv' : 'tvstand';
    case 'fun':
      return has(/speaker/) ? 'speaker' : 'generic';
    case 'rug':
      return has(/mat|runner/) ? 'mat' : 'rug';
    case 'plant':
      return 'plant';
    case 'decor':
      return has(/clock/) ? 'clock' : has(/frame/) ? 'frames' : has(/mirror/) && !wall ? 'mirror' : wall ? 'art' : 'generic';
    case 'window':
      return has(/blind/) ? 'blinds' : 'curtain';
    default:
      return 'generic';
  }
}

export function Sprite({ item, w, h }: { item: CatalogueItem; w: number; h: number }) {
  const initial = item.name.charAt(0);
  const art = item.verified ? VERIFIED_ART[item.id] : undefined;
  if (art) return art.draw({ palette: art.palette, initial }, { w, h });
  const kind = kindFor(item);
  const palette = kind === 'plant' ? PLANT_PALETTE : CATEGORY_PALETTES[item.category];
  return drawings[kind]({ palette, initial }, { w, h });
}
