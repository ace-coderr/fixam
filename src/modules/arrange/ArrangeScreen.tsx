import { useRef, useState, type FormEvent } from 'react';
import { Receipt } from '../../components/Receipt';
import { Room } from '../../components/Room';
import { arrange, rearrange, type Arrangement } from '../../engine/arrange';
import { executePlan, type ExecuteOutcome } from '../../engine/execute';
import { vibePresets, type StyleTag } from '../../engine/vibes';
import { groupDigits, naira, parseNaira } from '../../lib/naira';
import { useGame } from '../../shell/GameContext';

type Phase = 'compose' | 'working' | 'result' | 'paying' | 'fixed';

const tagWords: Partial<Record<StyleTag, string>> = {
  luxe: 'luxe',
  budget: 'thrifty',
  starter: 'the basics',
  minimal: 'clean lines',
  comfort: 'comfort',
  traditional: 'classic',
  family: 'family',
  hosting: 'hosting',
  party: 'party',
  food: 'food',
  work: 'work',
  tech: 'tech',
  study: 'study',
  power: 'backup power',
  cooling: 'staying cool',
  decor: 'decor',
  green: 'plants',
};

const MAX_BUDGET_DIGITS = 9;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ArrangeScreen() {
  const game = useGame();
  const planRef = useRef<HTMLDivElement>(null);

  const [vibe, setVibe] = useState('');
  const [budgetText, setBudgetText] = useState(groupDigits(150_000));
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [phase, setPhase] = useState<Phase>('compose');
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  /** Charged but not yet saved: the next tap retries the save, never the charge. */
  const [awaitingSave, setAwaitingSave] = useState(false);
  const retryRef = useRef<(() => Promise<ExecuteOutcome>) | null>(null);

  if (game.status !== 'ready') return null;
  const { room, wallet, storage, catalogue, catalogueById, pricing, capabilities } = game;
  const budget = parseNaira(budgetText);

  const showPlan = () => {
    planRef.current?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const fix = async (event: FormEvent) => {
    event.preventDefault();
    if (phase === 'working') return;
    setError(null);
    if (!vibe.trim()) {
      setError('Describe a vibe, or tap one of the suggestions.');
      return;
    }
    if (budget === null || budget <= 0) {
      setError('Enter a budget in naira, like 150,000.');
      return;
    }
    setPhase('working');
    // The leaning picker arrives with the next UI pass; until then, neutral.
    const outcome = await arrange({ vibe, leaning: 'neutral', budget, room, catalogue, storage, pricing, capabilities });
    if (!outcome.ok) {
      setError(outcome.message);
      setPhase('compose');
      return;
    }
    setArrangement(outcome.arrangement);
    setSelectedUid(null);
    setPhase('result');
    showPlan();
  };

  const reroll = () => {
    if (!arrangement) return;
    setError(null);
    const outcome = rearrange(arrangement, room);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    setArrangement(outcome.arrangement);
    setSelectedUid(null);
    showPlan();
  };

  const pay = async () => {
    if (!arrangement || phase === 'paying') return;
    setError(null);
    if (!awaitingSave && arrangement.grandTotal > wallet) {
      setError(
        `Not enough in your wallet. You have ${naira(wallet)} and this room costs ${naira(
          arrangement.grandTotal,
        )}. Lower the budget and make a new plan.`,
      );
      return;
    }
    setPhase('paying');
    const retry = awaitingSave ? retryRef.current : null;
    const outcome = retry ? await retry() : await executePlan(game.adapter, arrangement);
    if (!outcome.ok) {
      retryRef.current = outcome.retry ?? null;
      setAwaitingSave(!!outcome.retry);
      setError(outcome.message);
      setPhase('result');
      return;
    }
    retryRef.current = null;
    setAwaitingSave(false);
    await game.refresh();
    setPhase('fixed');
  };

  const edit = () => {
    setError(null);
    setSelectedUid(null);
    if (phase === 'fixed') setArrangement(null);
    setPhase('compose');
  };

  const pickPreset = (label: string, suggested: number) => {
    setVibe(label);
    if (!budgetTouched) setBudgetText(groupDigits(pricing.scale(suggested)));
  };

  const onBudgetChange = (value: string) => {
    setBudgetTouched(true);
    const digits = value.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_BUDGET_DIGITS);
    setBudgetText(digits ? groupDigits(Number(digits)) : '');
  };

  const composing = phase === 'compose' || phase === 'working';
  const showResult = arrangement && !composing;
  const selectedPick = arrangement?.placed.find((p) => p.uid === selectedUid);

  // Vocabulary: a generated layout is a plan. Only a paid plan is fixed.
  const fixed = phase === 'fixed';
  let title = 'Let’s fix your room';
  let lede: string | null = null;
  if (composing && arrangement) title = 'Change your plan';
  if (showResult) {
    const count = arrangement.placed.length;
    title = fixed ? 'Fixed' : 'Your plan';
    lede = fixed
      ? `Paid ${naira(arrangement.total)}. Everything is in your flat now.`
      : `${count} ${count === 1 ? 'piece' : 'pieces'} for ${naira(arrangement.total)}. Nothing is charged until you pay.`;
  }

  const errorNotice = error && (
    <div className="notice" role="alert">
      <p>{error}</p>
    </div>
  );

  const reading = arrangement?.reading;
  const caption = selectedPick
    ? `${selectedPick.item.name} · ${selectedPick.cost === 0 ? 'already yours' : naira(selectedPick.cost)}`
    : arrangement
      ? 'Tap a piece to find it on the receipt.'
      : `${room.widthCells / 2}m by ${room.heightCells / 2}m, one door, one window.`;

  return (
    <div className="arrange">
      <div className="arrange-title" ref={planRef}>
        <h1 className={fixed ? 'is-fixed' : undefined}>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>

      <Room
        room={room}
        layout={arrangement?.layout ?? []}
        items={catalogueById}
        runKey={arrangement?.seed ?? 'empty'}
        selectedUid={selectedUid}
        onSelect={setSelectedUid}
        overlay={
          !arrangement ? (
            <div className="invite">
              <p className="invite-title">Start with a vibe</p>
              <p>Say how you want the room to feel and what you can spend. Fixam plans the room and shows you the bill. Nothing is fixed until you pay.</p>
            </div>
          ) : undefined
        }
      />
      <p className="plan-caption" aria-live="polite">
        {caption}
      </p>

      {composing && (
        <form className="compose" onSubmit={fix} noValidate>
          <div className="field">
            <label htmlFor="vibe">Vibe</label>
            <input
              id="vibe"
              type="text"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              placeholder="soft life Lekki, but cosy"
              maxLength={120}
              autoComplete="off"
              enterKeyHint="go"
            />
          </div>
          <ul className="chips" aria-label="Vibe suggestions">
            {vibePresets.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  className={vibe === preset.label ? 'chip is-on' : 'chip'}
                  aria-pressed={vibe === preset.label}
                  onClick={() => pickPreset(preset.label, preset.suggestedBudget)}
                >
                  {preset.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="field">
            <label htmlFor="budget">Budget</label>
            <div className="budget-input">
              <span aria-hidden="true">₦</span>
              <input
                id="budget"
                type="text"
                inputMode="numeric"
                value={budgetText}
                onChange={(e) => onBudgetChange(e.target.value)}
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

          {errorNotice}
          <button type="submit" className="button-primary" disabled={phase === 'working'}>
            {phase === 'working' ? 'Planning…' : 'Fix my room'}
          </button>
          {arrangement && (
            <button type="button" className="button-text" onClick={() => setPhase('result')}>
              Back to the last plan
            </button>
          )}
        </form>
      )}

      {showResult && (
        <>
          {reading && reading.strongestTags.length > 0 && (
            <p className="reading">
              Read as {reading.strongestTags.map((tag) => tagWords[tag] ?? tag).join(', ')}
              {reading.understood ? '' : ', since the vibe didn’t match anything Fixam knows'}.
            </p>
          )}
          <Receipt
            arrangement={arrangement}
            wallet={wallet}
            paid={fixed}
            selectedUid={selectedUid}
            onSelect={setSelectedUid}
          />
          {errorNotice}
          <div className="actions">
            {!fixed && (
              <button type="button" className="button-primary" onClick={pay} disabled={phase === 'paying'}>
                {phase === 'paying' ? 'Paying…' : awaitingSave ? 'Save layout' : `Pay ${naira(arrangement.total)} to fix it`}
              </button>
            )}
            {!fixed && (
              <button
                type="button"
                className="button-secondary"
                onClick={reroll}
                disabled={phase === 'paying' || awaitingSave}
              >
                Try another layout
              </button>
            )}
            <button type="button" className="button-text" onClick={edit} disabled={phase === 'paying' || awaitingSave}>
              {fixed ? 'Start a new plan' : 'Change vibe or budget'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
