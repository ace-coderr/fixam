import { useId, type ReactNode } from 'react';
import type { Opening, PlacedItem, RoomSpec } from '../adapter/types';
import { getItem } from '../data/catalogue';
import { Sprite } from './sprites';

/** SVG units per grid cell, and the wall thickness drawn around the floor. */
const CELL = 24;
const WALL = 9;

interface RoomProps {
  room: RoomSpec;
  layout: PlacedItem[];
  /** Changing this replays the placement sequence. */
  runKey: string | number;
  selectedUid: string | null;
  onSelect: (uid: string | null) => void;
  overlay?: ReactNode;
}

/** Maps (along the wall, depth into the room) to plan coordinates for a given wall. */
function wallFrame(room: RoomSpec, wall: Opening['wall']) {
  const W = room.widthCells * CELL;
  const H = room.heightCells * CELL;
  return (u: number, v: number): [number, number] => {
    switch (wall) {
      case 'north':
        return [u, v];
      case 'south':
        return [u, H - v];
      case 'west':
        return [v, u];
      case 'east':
        return [W - v, u];
    }
  };
}

/** The opening cut through the wall band, as a rect in plan coordinates. */
function openingRect(room: RoomSpec, o: Opening) {
  const to = wallFrame(room, o.wall);
  const [x1, y1] = to(o.offset * CELL, -WALL);
  const [x2, y2] = to((o.offset + o.width) * CELL, 0);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

function Door({ room }: { room: RoomSpec }) {
  const { door } = room;
  const to = wallFrame(room, door.wall);
  const r = openingRect(room, door);
  const leaf = door.width * CELL;
  const hinge = door.offset * CELL;
  const [hx, hy] = to(hinge, 0);
  const [lx, ly] = to(hinge, leaf);
  const arc = Array.from({ length: 13 }, (_, i) => {
    const a = (i / 12) * (Math.PI / 2);
    const [x, y] = to(hinge + Math.cos(a) * leaf, Math.sin(a) * leaf);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <g aria-hidden="true">
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="var(--floor)" />
      <path d={arc} fill="none" stroke="var(--plan-line)" strokeWidth={0.9} strokeDasharray="3 2.5" />
      <path d={`M${hx} ${hy} L${lx} ${ly}`} stroke="var(--plan-ink)" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Window({ room }: { room: RoomSpec }) {
  const r = openingRect(room, room.window);
  const horizontal = r.w > r.h;
  return (
    <g aria-hidden="true">
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="var(--glass)" stroke="var(--plan-ink)" strokeWidth={0.8} />
      {horizontal ? (
        <path d={`M${r.x} ${r.y + r.h / 2} H${r.x + r.w}`} stroke="var(--plan-ink)" strokeWidth={0.8} />
      ) : (
        <path d={`M${r.x + r.w / 2} ${r.y} V${r.y + r.h}`} stroke="var(--plan-ink)" strokeWidth={0.8} />
      )}
    </g>
  );
}

function describe(room: RoomSpec, layout: PlacedItem[]): string {
  const size = `${room.widthCells / 2}m by ${room.heightCells / 2}m`;
  if (layout.length === 0) return `Floor plan of an empty room, ${size}.`;
  const names = layout.map((p) => getItem(p.itemId).name.toLowerCase());
  return `Floor plan, ${size}, with ${names.length} items: ${names.join(', ')}.`;
}

export function Room({ room, layout, runKey, selectedUid, onSelect, overlay }: RoomProps) {
  const gridId = `grid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const W = room.widthCells * CELL;
  const H = room.heightCells * CELL;

  // Rugs first, furniture on top, wall-mounts last so they sit on the wall line.
  const layerRank = { flat: 0, floor: 1, wall: 2 } as const;
  const drawOrder = layout
    .map((p, sequence) => ({ p, sequence }))
    .sort((a, b) => layerRank[a.p.layer] - layerRank[b.p.layer]);
  const selected = layout.find((p) => p.uid === selectedUid);

  return (
    <div className="plan">
      <svg
        viewBox={`${-WALL} ${-WALL} ${W + WALL * 2} ${H + WALL * 2}`}
        role="img"
        aria-label={describe(room, layout)}
        onClick={() => onSelect(null)}
      >
        <defs>
          <pattern id={gridId} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path d={`M${CELL} 0 H0 V${CELL}`} fill="none" stroke="var(--plan-grid)" strokeWidth={0.6} />
          </pattern>
        </defs>

        <rect x={-WALL} y={-WALL} width={W + WALL * 2} height={H + WALL * 2} rx={3} fill="var(--wall)" />
        <rect x={0} y={0} width={W} height={H} fill="var(--floor)" />
        <rect x={0} y={0} width={W} height={H} fill={`url(#${gridId})`} />
        <Window room={room} />
        <Door room={room} />

        <g key={runKey}>
          {drawOrder.map(({ p, sequence }) => {
            const item = getItem(p.itemId);
            const fw = p.w * CELL;
            const fh = p.h * CELL;
            const lw = p.rot % 2 === 0 ? fw : fh;
            const lh = p.rot % 2 === 0 ? fh : fw;
            const transform = `translate(${p.x * CELL + fw / 2} ${p.y * CELL + fh / 2}) rotate(${p.rot * 90}) translate(${-lw / 2} ${-lh / 2})`;
            return (
              <g
                key={p.uid}
                transform={transform}
                className="plan-item"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(p.uid === selectedUid ? null : p.uid);
                }}
              >
                <g className="drop" style={{ animationDelay: `${sequence * 60}ms` }}>
                  {/* Generous invisible hit area so small items are easy to tap. */}
                  <rect width={lw} height={lh} fill="transparent" />
                  <Sprite item={item} w={lw} h={lh} />
                </g>
              </g>
            );
          })}
        </g>

        {selected && (
          <rect
            className="plan-selected"
            x={selected.x * CELL - 1.5}
            y={selected.y * CELL - (selected.layer === 'wall' ? 0 : 1.5)}
            width={selected.w * CELL + 3}
            height={selected.h * CELL + 3}
            rx={3}
            fill="none"
            stroke="var(--brass)"
            strokeWidth={2}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}
      </svg>
      {overlay && <div className="plan-overlay">{overlay}</div>}
    </div>
  );
}
