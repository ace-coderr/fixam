import type { ReactNode } from 'react';

/**
 * The Ace worker: the decorator Ace sends to fix your room. Flat vector,
 * drawn so the uniform (brass cap and overalls, Ace chest patch, tape measure)
 * carries the figure and the face stays simple. Later there will be many Ace
 * workers; vary `tone` and the uniform still says who they are.
 */

export type WorkerPose = 'greet' | 'measure' | 'done';

const INK = '#0F1522';
const BRASS = '#D29A3A';
const BRASS_DARK = '#A8741E';
const SHIRT = '#2E3B66';
const CHALK = '#EDE7DA';
const TAPE = '#F2D27A';
const BOOT = '#1B1F2A';

const outline = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

interface Props {
  pose: WorkerPose;
  /** Skin tone. */
  tone?: string;
  /** Accessible description. */
  label?: string;
}

/** An arm as a sleeve-coloured stroke ending in a hand. */
function Arm({ d, hand, tone }: { d: string; hand: [number, number]; tone: string }) {
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={SHIRT} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={hand[0]} cy={hand[1]} r={5.6} fill={tone} {...outline} />
    </g>
  );
}

function TapeCase({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={14} height={13} rx={4} fill="#4A5675" stroke={INK} strokeWidth={1.4} />
      <circle cx={x + 7} cy={y + 6.5} r={3} fill={BRASS} />
      <rect x={x + 12} y={y + 9} width={4} height={3} rx={1} fill={TAPE} stroke={INK} strokeWidth={0.8} />
    </g>
  );
}

/** A small finished room, seen from above, for the done pose. */
function FinishedRoom() {
  return (
    <g>
      <rect x={6} y={14} width={148} height={112} rx={10} fill="#3A4560" />
      <rect x={13} y={21} width={134} height={98} rx={4} fill={CHALK} />
      <rect x={52} y={52} width={56} height={36} rx={3} fill="#C7B9D8" stroke="#6F5E92" strokeWidth={1.4} />
      <path d="M80 58 L96 70 L80 82 L64 70 Z" fill="#8A78B3" opacity={0.7} />
      <rect x={18} y={26} width={40} height={16} rx={4} fill="#2F6B5E" stroke={INK} strokeWidth={1.2} />
      <rect x={24} y={30} width={13} height={10} rx={2} fill="#3B8574" />
      <rect x={39} y={30} width={13} height={10} rx={2} fill="#3B8574" />
      <rect x={112} y={26} width={30} height={12} rx={2} fill="#4A3526" stroke={INK} strokeWidth={1.2} />
      <rect x={116} y={28.5} width={22} height={3} rx={1} fill="#151922" />
      <circle cx={134} cy={104} r={7} fill="#2E7D5B" stroke={INK} strokeWidth={1.2} />
      <circle cx={24} cy={106} r={6} fill="#EBD9A4" stroke={INK} strokeWidth={1.2} />
      <rect x={70} y={14} width={22} height={7} fill="#B9D1E6" stroke={INK} strokeWidth={0.8} />
    </g>
  );
}

export function AceWorker({ pose, tone = '#7A4A2B', label = 'Your Ace worker' }: Props) {
  // The done pose stands in front of the room, so its figure is drawn lower and to the side.
  const shift = pose === 'done' ? 'translate(34 22)' : undefined;
  return (
    <svg viewBox={pose === 'done' ? '0 0 160 222' : '0 0 160 200'} role="img" aria-label={label}>
      {pose === 'done' && <FinishedRoom />}
      <g transform={shift}>
        <ellipse cx={80} cy={180} rx={34} ry={5} fill="#000" opacity={0.25} />

        {/* Arms behind the body */}
        {pose === 'greet' && <Arm d="M62 70 L54 96 L58 118" hand={[58, 120]} tone={tone} />}
        {pose === 'done' && <Arm d="M62 70 L48 92 L62 106" hand={[63, 106]} tone={tone} />}

        {/* Legs and boots */}
        <path d="M60 104 H100 V168 H83.5 L80 132 L76.5 168 H60 Z" fill={BRASS} {...outline} />
        <path d="M80 132 V112" stroke={BRASS_DARK} strokeWidth={1.4} />
        <rect x={56} y={165} width={24} height={11} rx={5} fill={BOOT} {...outline} />
        <rect x={80} y={165} width={24} height={11} rx={5} fill={BOOT} {...outline} />

        {/* Shirt */}
        <rect x={58} y={62} width={44} height={48} rx={13} fill={SHIRT} {...outline} />

        {/* Overall bib, straps and patch */}
        <path d="M64 76 H96 V110 H64 Z" fill={BRASS} {...outline} />
        <path d="M64 77 L61 63 M96 77 L99 63" stroke={BRASS} strokeWidth={6} strokeLinecap="round" />
        <path d="M64 77 L61 63 M96 77 L99 63" stroke={INK} strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.5} />
        <circle cx={65.5} cy={78.5} r={2} fill={BRASS_DARK} />
        <circle cx={94.5} cy={78.5} r={2} fill={BRASS_DARK} />
        <rect x={70} y={83} width={20} height={12} rx={3} fill={INK} />
        <text x={80} y={92} textAnchor="middle" fontSize={7.4} fontWeight={800} fill={CHALK} fontFamily="var(--font-display), sans-serif" letterSpacing={0.4}>
          ACE
        </text>
        <rect x={67} y={100} width={10} height={7} rx={2} fill="none" stroke={BRASS_DARK} strokeWidth={1.2} />

        {/* Tape measure on the hip, unless it's in hand */}
        {pose !== 'measure' && <TapeCase x={94} y={102} />}

        {/* Neck, head, face, cap */}
        <rect x={75} y={55} width={10} height={9} fill={tone} {...outline} />
        <circle cx={80} cy={42} r={16} fill={tone} {...outline} />
        <circle cx={74.5} cy={44.5} r={1.7} fill={INK} />
        <circle cx={85.5} cy={44.5} r={1.7} fill={INK} />
        <path d={pose === 'measure' ? 'M76 51.5 H84' : 'M74.5 50 Q80 55 85.5 50'} fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M63.5 39 A16.5 16.5 0 0 1 96.5 39 Z" fill={BRASS} {...outline} />
        <path d="M92 37.5 H108 A3 3 0 0 1 108 42 H92 Z" fill={BRASS_DARK} {...outline} />
        <circle cx={80} cy={31} r={2.4} fill={INK} />

        {/* Arms in front of the body */}
        {pose === 'greet' && (
          <g className="worker-wave">
            <Arm d="M98 70 L114 54 L116 32" hand={[116, 30]} tone={tone} />
          </g>
        )}
        {pose === 'measure' && (
          <>
            <Arm d="M62 72 L44 86 L34 88" hand={[33, 88]} tone={tone} />
            <Arm d="M98 72 L116 86 L126 88" hand={[127, 88]} tone={tone} />
            <TapeCase x={20} y={82} />
            <g className="worker-tape">
              <rect x={36} y={86} width={88} height={6} fill={TAPE} stroke={INK} strokeWidth={1} />
              {Array.from({ length: 11 }, (_, i) => (
                <path key={i} d={`M${40 + i * 8} 86 V${i % 2 ? 89 : 90.5}`} stroke={INK} strokeWidth={0.8} />
              ))}
            </g>
          </>
        )}
        {pose === 'done' && (
          <g>
            <Arm d="M98 70 L114 88 L110 72" hand={[110, 70]} tone={tone} />
            <path d="M110 64.5 V58" stroke={INK} strokeWidth={6} strokeLinecap="round" />
            <path d="M110 64.5 V58" stroke={tone} strokeWidth={3.6} strokeLinecap="round" />
          </g>
        )}
      </g>
    </svg>
  );
}

/** The Ace worker with a line of speech beside them. */
export function WorkerSays({ pose, children, large = false }: { pose: WorkerPose; children: ReactNode; large?: boolean }) {
  return (
    <div className={large ? 'worker is-large' : 'worker'}>
      <div className="worker-figure">
        <AceWorker pose={pose} />
      </div>
      <p className="speech" aria-live="polite">
        <span className="speech-who">Your Ace worker</span>
        {children}
      </p>
    </div>
  );
}
