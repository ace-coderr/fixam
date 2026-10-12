import type { FormEvent, ReactNode } from 'react';
import type { CatalogueItem, House, Property, Room as RoomData, RoomType } from '../../adapter/types';
import { WorkerSays } from '../../components/AceWorker';
import { Receipt, SellSuggestions } from '../../components/Receipt';
import { Room } from '../../components/Room';
import { ChevronRight, CtaBar, Notice, Tick } from '../../components/ui';
import type { Arrangement, PlanStep } from '../../engine/arrange';
import type { ExecutionMode, Pricing } from '../../engine/pricing';
import { vibePresets, type Leaning } from '../../engine/vibes';
import { naira } from '../../lib/naira';
import { lines, roomNoun, roomTypeLabel, tierLabel } from './words';

const size = (w: number, h: number) => `${w}×${h}`;

// Home ----------------------------------------------------------------------------

export function HomeScreen({
  name,
  properties,
  pricing,
  onOpen,
}: {
  name: string;
  properties: Property[];
  pricing: Pricing;
  onOpen: (property: Property) => void;
}) {
  // Where the player lives goes first.
  const sorted = [...properties].sort((a, b) => Number(b.livesHere) - Number(a.livesHere));
  return (
    <div className="screen">
      <WorkerSays pose="greet" large>
        {lines.home(name)}
      </WorkerSays>
      <h2 className="section-title">Your homes 🏠</h2>
      <ul className="screen" style={{ gap: 10 }}>
        {sorted.map((p) => (
          <li key={p.id}>
            <button type="button" className="card card-button" onClick={() => onOpen(p)}>
              <span className="card-row">
                <span>
                  <span className="card-title">{p.name}</span>
                  <span className="card-meta" style={{ display: 'block' }}>
                    {p.name.toLowerCase().includes(p.tier.toLowerCase()) ? '' : `${tierLabel(p.tier)} · `}
                    {size(p.widthCells, p.heightCells)}
                  </span>
                </span>
                <ChevronRight />
              </span>
              <span className="pills">
                {p.livesHere && <span className="pill is-brass">You live here</span>}
                <span className="pill">
                  Worth <span className="naira">{naira(pricing.scale(p.basePrice))}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="footer-note">Fixam is a product of Ace.</p>
    </div>
  );
}

// Room picker ----------------------------------------------------------------------

export function RoomsScreen({
  property,
  house,
  error,
  onRetry,
  onPick,
}: {
  property: Property;
  house: House | null;
  error: string | null;
  onRetry: () => void;
  onPick: (room: RoomData) => void;
}) {
  const rooms = house ? [...house.rooms, house.yard] : [];
  return (
    <div className="screen">
      <WorkerSays pose="greet">{lines.rooms}</WorkerSays>
      <h2 className="section-title">{property.name}</h2>
      {error && (
        <Notice>
          <p>{error}</p>
          <button type="button" className="button-secondary" onClick={onRetry}>
            Try again
          </button>
        </Notice>
      )}
      {!house && !error && (
        <p className="muted" role="status">
          Opening the house…
        </p>
      )}
      <ul className="screen" style={{ gap: 10 }}>
        {rooms.map((room) => (
          <li key={room.id}>
            <button type="button" className="card card-button" onClick={() => onPick(room)}>
              <span className="card-row">
                <span>
                  <span className="card-title">{room.label}</span>
                  <span className="card-meta" style={{ display: 'block' }}>
                    {size(room.widthCells, room.heightCells)}
                  </span>
                </span>
                <ChevronRight />
              </span>
              <span className="pills">
                {room.label.toLowerCase() !== roomTypeLabel[room.type].toLowerCase() && (
                  <span className={room.type === 'unassigned' ? 'pill is-brass' : 'pill'}>{roomTypeLabel[room.type]}</span>
                )}
                {room.furnished ? <span className="pill is-green">Furnished</span> : <span className="pill">Empty</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Purpose for an unassigned room ------------------------------------------------------

const PURPOSES: { type: RoomType; label: string; note?: string }[] = [
  { type: 'unassigned', label: 'All of it', note: 'Sleep, sit and cook' },
  { type: 'bedroom', label: 'Bedroom' },
  { type: 'parlour', label: 'Parlour' },
  { type: 'kitchen', label: 'Kitchen' },
  { type: 'study', label: 'Study' },
  { type: 'bath', label: 'Bathroom' },
];

export function PurposeScreen({
  room,
  chosen,
  onChoose,
  onContinue,
}: {
  room: RoomData;
  chosen: RoomType | null;
  onChoose: (type: RoomType) => void;
  onContinue: () => void;
}) {
  return (
    <div className="screen">
      <WorkerSays pose="greet">{lines.purpose}</WorkerSays>
      <h2 className="section-title">
        {room.label} · {size(room.widthCells, room.heightCells)}
      </h2>
      <div className="choices is-two" role="radiogroup" aria-label="What this room is for">
        {PURPOSES.map((p) => (
          <button
            key={p.type}
            type="button"
            role="radio"
            aria-checked={chosen === p.type}
            className={chosen === p.type ? 'choice is-on' : 'choice'}
            onClick={() => onChoose(p.type)}
          >
            {p.label}
            {p.note && <small>{p.note}</small>}
          </button>
        ))}
      </div>
      <CtaBar>
        <button type="button" className="button-primary" disabled={!chosen} onClick={onContinue}>
          Continue
        </button>
      </CtaBar>
    </div>
  );
}

// Brief ---------------------------------------------------------------------------

export interface Brief {
  vibe: string;
  budgetText: string;
  budgetTouched: boolean;
  /** Null until the player picks one; planned as neutral if skipped. */
  leaning: Leaning | null;
}

const LEANINGS: { value: Leaning; label: string }[] = [
  { value: 'masculine', label: 'Masculine' },
  { value: 'feminine', label: 'Feminine' },
  { value: 'neutral', label: 'Neutral' },
];

export function BriefScreen({
  room,
  brief,
  wallet,
  budget,
  mode,
  error,
  suggestedBudget,
  onChange,
  onSubmit,
}: {
  room: RoomData;
  brief: Brief;
  wallet: number;
  budget: number | null;
  mode: ExecutionMode;
  error: string | null;
  suggestedBudget: (base: number) => number;
  onChange: (next: Partial<Brief>) => void;
  onSubmit: () => void;
}) {
  const noun = roomNoun(room.type, room.label);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="screen" onSubmit={submit} noValidate>
      <WorkerSays pose="greet">{lines.brief(noun)}</WorkerSays>

      <div className="field">
        <label className="field-label" htmlFor="vibe">
          The vibe
        </label>
        <input
          id="vibe"
          className="input"
          type="text"
          value={brief.vibe}
          onChange={(e) => onChange({ vibe: e.target.value })}
          placeholder="soft life Lekki, but cosy"
          maxLength={120}
          autoComplete="off"
          enterKeyHint="done"
        />
      </div>
      <ul className="chips" aria-label="Vibe suggestions">
        {vibePresets.map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              className={brief.vibe === preset.label ? 'chip is-on' : 'chip'}
              aria-pressed={brief.vibe === preset.label}
              onClick={() =>
                onChange(
                  brief.budgetTouched
                    ? { vibe: preset.label }
                    : { vibe: preset.label, budgetText: groupDigits(suggestedBudget(preset.suggestedBudget)) },
                )
              }
            >
              {preset.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="field">
        <label className="field-label" htmlFor="budget">
          Budget
        </label>
        <div className="input money-input">
          <span aria-hidden="true">₦</span>
          <input
            id="budget"
            type="text"
            inputMode="numeric"
            value={brief.budgetText}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
              onChange({ budgetTouched: true, budgetText: digits ? groupDigits(Number(digits)) : '' });
            }}
            placeholder="150,000"
            autoComplete="off"
            aria-describedby="budget-hint"
          />
        </div>
        <p id="budget-hint" className={budget !== null && budget > wallet ? 'hint is-warn' : 'hint'}>
          {budget !== null && budget > wallet
            ? `That’s more than the ${naira(wallet)} in your wallet. You can plan it, but you’ll need the money to pay.`
            : `You have ${naira(wallet)} in your wallet.`}
        </p>
      </div>

      <div className="field">
        <span className="field-label" id="leaning-label">
          Leaning
        </span>
        <div className="choices" role="radiogroup" aria-labelledby="leaning-label">
          {LEANINGS.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={brief.leaning === l.value}
              className={brief.leaning === l.value ? 'choice is-on' : 'choice'}
              onClick={() => onChange({ leaning: brief.leaning === l.value ? null : l.value })}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="hint">Your choice shifts colours and pieces. Skip it and I’ll keep things neutral.</p>
      </div>

      <div className="card">
        <p className="card-title" style={{ fontSize: 'var(--step-0)' }}>
          {mode === 'full-service' ? 'I’ll buy and place everything' : 'You’ll place things yourself'}
        </p>
        <p className="card-meta">
          {mode === 'full-service'
            ? 'Pieces come from the Lagos Life shop and your own storage. You pay the shop from your wallet, plus Fixam’s fee when the job is done.'
            : 'I’ll plan the room and give you the steps, in order, with where each piece goes. You pay Fixam’s fee for the plan.'}
        </p>
      </div>

      {error && (
        <Notice>
          <p>{error}</p>
        </Notice>
      )}

      <CtaBar>
        <button type="submit" className="button-primary">
          Fix my room
        </button>
      </CtaBar>
    </form>
  );
}

function groupDigits(n: number): string {
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(n);
}

// Plan ------------------------------------------------------------------------------

export function PlanCard({
  room,
  arrangement,
  items,
  selectedUid,
  onSelect,
  caption,
  showGrid = false,
}: {
  room: RoomData;
  arrangement: Arrangement | null;
  items: ReadonlyMap<string, CatalogueItem>;
  selectedUid: string | null;
  onSelect: (uid: string | null) => void;
  caption?: ReactNode;
  showGrid?: boolean;
}) {
  return (
    <div className="card plan-card">
      <Room
        showGrid={showGrid}
        room={room}
        layout={arrangement?.layout ?? []}
        items={items}
        floor={arrangement?.finishes.floor ?? room.floor}
        wallPaint={arrangement?.finishes.wallPaint ?? room.wallPaint}
        runKey={arrangement?.seed ?? 'empty'}
        selectedUid={selectedUid}
        onSelect={onSelect}
      />
      <p className="plan-caption" aria-live="polite">
        {caption}
      </p>
    </div>
  );
}

export function PlanScreen({
  room,
  arrangement,
  measuring,
  items,
  selectedUid,
  onSelect,
  error,
  onReroll,
  onProceed,
}: {
  room: RoomData;
  arrangement: Arrangement | null;
  measuring: boolean;
  items: ReadonlyMap<string, CatalogueItem>;
  selectedUid: string | null;
  onSelect: (uid: string | null) => void;
  error: string | null;
  onReroll: () => void;
  onProceed: () => void;
}) {
  const noun = roomNoun(room.type, room.label);
  if (measuring || !arrangement) {
    return (
      <div className="screen">
        <WorkerSays pose="measure">{lines.measuring}</WorkerSays>
        <PlanCard room={room} arrangement={null} items={items} selectedUid={null} onSelect={() => {}} caption={size(room.widthCells, room.heightCells)} />
      </div>
    );
  }
  const selected = arrangement.placed.find((p) => p.uid === selectedUid);
  const owned = arrangement.placed.filter((p) => p.owned).length;
  const pieces = arrangement.layout.length;
  const due = arrangement.mode === 'full-service' ? arrangement.grandTotal : arrangement.fee;
  return (
    <div className="screen">
      <WorkerSays pose="greet">{lines.plan(noun)}</WorkerSays>
      <PlanCard
        room={room}
        arrangement={arrangement}
        items={items}
        selectedUid={selectedUid}
        onSelect={onSelect}
        caption={
          selected
            ? `${selected.item.name} · ${selected.owned ? 'already yours' : naira(selected.cost)}`
            : `${size(room.widthCells, room.heightCells)} · ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`
        }
      />
      <div className="pills" style={{ marginTop: 0 }}>
        <span className="pill">{Math.round(arrangement.coverage * 100)}% of the floor used</span>
        {owned > 0 && <span className="pill is-green">{owned} from your storage</span>}
        {arrangement.finishes.wallPaint && <span className="pill">New paint</span>}
        {arrangement.finishes.floor && <span className="pill">New floor</span>}
      </div>
      <button type="button" className="button-secondary" onClick={onReroll}>
        Try another layout
      </button>
      <Receipt arrangement={arrangement} stamp={null} selectedUid={selectedUid} onSelect={onSelect} />
      <SellSuggestions suggestions={arrangement.sellSuggestions} />
      {error && (
        <Notice>
          <p>{error}</p>
        </Notice>
      )}
      <CtaBar>
        <button type="button" className="button-primary" onClick={onProceed}>
          {arrangement.mode === 'full-service' ? `Pay ${naira(due)} to fix it` : `Get the steps for ${naira(due)}`}
        </button>
      </CtaBar>
    </div>
  );
}

// Execute: full service ------------------------------------------------------------------

export interface Stage {
  label: string;
}

export function JobScreen({
  room,
  stages,
  active,
  failed,
  canRetry,
  onRetry,
}: {
  room: RoomData;
  stages: Stage[];
  active: number;
  failed: string | null;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const progress = Math.min(1, active / stages.length);
  return (
    <div className="screen">
      <WorkerSays pose="measure">{failed ? 'Something held us up.' : lines.working}</WorkerSays>
      <div className="card">
        <p className="card-title">Fixing your {roomNoun(room.type, room.label)}</p>
        <div className="progress-track" style={{ marginTop: 12 }} aria-hidden="true">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <ol className="job-stages" style={{ marginTop: 10 }}>
          {stages.map((s, i) => (
            <li key={s.label} className={i < active ? 'is-done' : i === active && !failed ? 'is-active' : undefined}>
              <span className="stage-dot" aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ol>
      </div>
      {failed && (
        <Notice>
          <p>{failed}</p>
          {canRetry && (
            <button type="button" className="button-secondary" onClick={onRetry}>
              Try again
            </button>
          )}
        </Notice>
      )}
    </div>
  );
}

export function FixedScreen({
  room,
  arrangement,
  items,
  onDone,
}: {
  room: RoomData;
  arrangement: Arrangement;
  items: ReadonlyMap<string, CatalogueItem>;
  onDone: () => void;
}) {
  const noun = roomNoun(room.type, room.label);
  return (
    <div className="screen">
      <WorkerSays pose="done" large>
        {lines.ready(noun)}
      </WorkerSays>
      <h1 className="big-title" style={{ textAlign: 'center' }}>
        Fixed
      </h1>
      <PlanCard room={room} arrangement={arrangement} items={items} selectedUid={null} onSelect={() => {}} caption={`${room.label} · ${size(room.widthCells, room.heightCells)}`} />
      <Receipt arrangement={arrangement} stamp={arrangement.mode === 'full-service' ? 'Paid' : 'Done'} selectedUid={null} onSelect={() => {}} />
      <CtaBar>
        <button type="button" className="button-primary" onClick={onDone}>
          Back to my homes
        </button>
      </CtaBar>
    </div>
  );
}

// Execute: plan only ----------------------------------------------------------------------

const FACING: Record<string, string> = { north: 'top', east: 'right', south: 'bottom', west: 'left' };

function stepTitle(step: PlanStep): string {
  if (step.action === 'paint') return `Paint the walls ${step.name}`;
  if (step.action === 'floor') return `Lay the ${step.name} floor`;
  return step.name;
}

const OPPOSITE: Record<string, string> = { north: 'south', east: 'west', south: 'north', west: 'east' };

function stepDetail(step: PlanStep, item: CatalogueItem | undefined): string {
  if (step.action !== 'place' || step.x === undefined || step.y === undefined) return 'Before anything goes in';
  const where = `Column ${step.x + 1}, row ${step.y + 1}`;
  if (item?.placement === 'wallmount' && step.facing) {
    // Hung pieces face into the room from the wall behind them.
    return `${where} · on the ${FACING[OPPOSITE[step.facing] as string]} wall`;
  }
  const turn = `rotated ${step.rotation ?? 0}°`;
  const face = step.facing ? `, facing ${FACING[step.facing]}` : '';
  return `${where} · ${turn}${face}`;
}

export function StepsScreen({
  room,
  arrangement,
  items,
  steps,
  done,
  onToggle,
  onFinish,
}: {
  room: RoomData;
  arrangement: Arrangement;
  items: ReadonlyMap<string, CatalogueItem>;
  steps: PlanStep[];
  done: ReadonlySet<number>;
  onToggle: (order: number) => void;
  onFinish: () => void;
}) {
  const count = steps.filter((s) => done.has(s.order)).length;
  const all = count === steps.length;
  if (all) return <FixedScreen room={room} arrangement={arrangement} items={items} onDone={onFinish} />;
  return (
    <div className="screen">
      <WorkerSays pose="greet">{lines.steps}</WorkerSays>
      <PlanCard room={room} arrangement={arrangement} items={items} selectedUid={null} onSelect={() => {}} showGrid caption="Columns are numbered along the top, rows down the side." />
      <div className="card-row">
        <h2 className="section-title" style={{ margin: 0 }}>
          Your steps 🛠️
        </h2>
        <span className="pill">
          {count} of {steps.length} done
        </span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${(count / steps.length) * 100}%` }} />
      </div>
      <ol className="steps">
        {steps.map((step) => {
          const ticked = done.has(step.order);
          return (
            <li key={step.order} className={ticked ? 'card step is-done' : 'card step'}>
              <span className="step-number">{step.order}</span>
              <span>
                <span className="step-title" style={{ display: 'block' }}>
                  {stepTitle(step)}
                </span>
                <span className="step-detail" style={{ display: 'block' }}>
                  {stepDetail(step, items.get(step.itemId))}
                </span>
                <span className="pills" style={{ marginTop: 6 }}>
                  {step.source === 'storage' ? (
                    <span className="pill is-green">From your storage</span>
                  ) : (
                    <span className="pill is-brass">Buy · {naira(step.price)}</span>
                  )}
                </span>
              </span>
              <button
                type="button"
                className="tick"
                aria-pressed={ticked}
                aria-label={`${ticked ? 'Undo' : 'Mark done'}: step ${step.order}, ${stepTitle(step)}`}
                onClick={() => onToggle(step.order)}
              >
                <Tick />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
