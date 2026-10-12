import { useEffect, useRef, useState } from 'react';
import type { House, Property, Room, RoomType } from '../../adapter/types';
import { Header } from '../../components/ui';
import { arrange, executionMode, rearrange, type Arrangement, type PlanStep } from '../../engine/arrange';
import { executePlan, type ExecuteOutcome } from '../../engine/execute';
import { naira, parseNaira } from '../../lib/naira';
import { useGame } from '../../shell/GameContext';
import {
  BriefScreen,
  FixedScreen,
  HomeScreen,
  JobScreen,
  PlanScreen,
  PurposeScreen,
  RoomsScreen,
  StepsScreen,
  type Brief,
  type Stage,
} from './screens';

type Step = 'home' | 'rooms' | 'purpose' | 'brief' | 'plan' | 'execute';

type Job =
  | { status: 'idle' }
  | { status: 'running'; stage: number }
  | { status: 'failed'; stage: number; message: string; canRetry: boolean; charged: boolean }
  | { status: 'fixed' }
  | { status: 'steps'; steps: PlanStep[]; done: ReadonlySet<number> };

/** The suggested budgets are for a 6×6 room at starter prices; scale to this room and player. */
const REFERENCE_CELLS = 36;
/** A sensible opening budget for a room before any vibe is picked, at starter prices for 6×6. */
const OPENING_BUDGET = 60_000;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function groupDigits(n: number): string {
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(n);
}

export default function ArrangeScreen() {
  const game = useGame();
  const [step, setStep] = useState<Step>('home');
  const [property, setProperty] = useState<Property | null>(null);
  const [house, setHouse] = useState<House | null>(null);
  const [houseError, setHouseError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [purposes, setPurposes] = useState<Record<string, RoomType>>({});
  const [purposeDraft, setPurposeDraft] = useState<RoomType | null>(null);
  const [brief, setBrief] = useState<Brief>({ vibe: '', budgetText: '', budgetTouched: false, leaning: null });
  const [briefError, setBriefError] = useState<string | null>(null);
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [job, setJob] = useState<Job>({ status: 'idle' });
  const retryRef = useRef<(() => Promise<ExecuteOutcome>) | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  if (game.status !== 'ready') return null;
  const { player, properties, pricing, wallet, capabilities, catalogue, catalogueById, storage } = game;
  const mode = executionMode(capabilities);

  const baseRoom = house && roomId ? [...house.rooms, house.yard].find((r) => r.id === roomId) ?? null : null;
  const purpose = roomId ? purposes[roomId] : undefined;
  const room: Room | null = baseRoom && baseRoom.type === 'unassigned' && purpose ? { ...baseRoom, type: purpose } : baseRoom;
  const budget = parseNaira(brief.budgetText);
  const scaleBudget = (base: number, r: Room | null = room) => {
    const cells = r ? r.widthCells * r.heightCells : REFERENCE_CELLS;
    return Math.round(pricing.scale((base * cells) / REFERENCE_CELLS) / 1_000) * 1_000;
  };

  const loadHouse = async (p: Property) => {
    setHouse(null);
    setHouseError(null);
    try {
      setHouse(await game.adapter.getHouse(p.id));
    } catch {
      setHouseError('Couldn’t open this house from the game. Check your connection and try again.');
    }
  };

  // Navigation ------------------------------------------------------------------

  const openProperty = (p: Property) => {
    setProperty(p);
    setStep('rooms');
    void loadHouse(p);
  };

  const pickRoom = (r: Room) => {
    setRoomId(r.id);
    setArrangement(null);
    setSelectedUid(null);
    setBriefError(null);
    setPlanError(null);
    setJob({ status: 'idle' });
    setBrief((b) => ({ ...b, budgetText: b.budgetTouched ? b.budgetText : groupDigits(scaleBudget(OPENING_BUDGET, r)) }));
    if (r.type === 'unassigned' && !purposes[r.id]) {
      setPurposeDraft(null);
      setStep('purpose');
    } else {
      setStep('brief');
    }
  };

  const goHome = async () => {
    setStep('home');
    setArrangement(null);
    setJob({ status: 'idle' });
    retryRef.current = null;
    await game.refresh();
    if (property) void loadHouse(property);
  };

  const back = (() => {
    switch (step) {
      case 'home':
        return undefined;
      case 'rooms':
        return () => setStep('home');
      case 'purpose':
        return () => setStep('rooms');
      case 'brief':
        return () => setStep(baseRoom?.type === 'unassigned' ? 'purpose' : 'rooms');
      case 'plan':
        return measuring ? undefined : () => setStep('brief');
      case 'execute':
        if (job.status === 'running') return undefined;
        if (job.status === 'failed' && !job.charged) return () => setStep('plan');
        return () => void goHome();
    }
  })();

  // Planning --------------------------------------------------------------------

  const makePlan = async () => {
    if (!room) return;
    setBriefError(null);
    if (!brief.vibe.trim()) {
      setBriefError('Describe a vibe, or tap one of the suggestions.');
      return;
    }
    if (budget === null || budget <= 0) {
      setBriefError('Enter a budget in naira, like 150,000.');
      return;
    }
    setStep('plan');
    setMeasuring(true);
    setPlanError(null);
    setSelectedUid(null);
    const minimum = wait(reducedMotion() ? 200 : 1_400);
    const outcome = await arrange({
      vibe: brief.vibe,
      leaning: brief.leaning ?? 'neutral',
      budget,
      room,
      catalogue,
      storage,
      pricing,
      capabilities,
    });
    await minimum;
    setMeasuring(false);
    if (!outcome.ok) {
      setBriefError(outcome.message);
      setStep('brief');
      return;
    }
    setArrangement(outcome.arrangement);
  };

  const reroll = () => {
    if (!arrangement) return;
    const outcome = rearrange(arrangement);
    if (!outcome.ok) {
      setPlanError(outcome.message);
      return;
    }
    setPlanError(null);
    setSelectedUid(null);
    setArrangement(outcome.arrangement);
  };

  // Doing the job -----------------------------------------------------------------

  const stages: Stage[] = [
    { label: 'Buying from the shop' },
    ...(arrangement?.finishes.floor || arrangement?.finishes.wallPaint ? [{ label: 'Painting and laying the floor' }] : []),
    { label: 'Carrying everything in' },
    { label: 'Putting each piece in its place' },
    { label: 'Settling Fixam’s fee' },
  ];

  const runJob = async (retry?: () => Promise<ExecuteOutcome>) => {
    if (!arrangement) return;
    setStep('execute');
    if (arrangement.mode === 'plan-only') {
      setJob({ status: 'running', stage: 0 });
      const [outcome] = await Promise.all([executePlan(game.adapter, arrangement), wait(reducedMotion() ? 0 : 900)]);
      if (outcome.ok && outcome.mode === 'plan-only') {
        setJob({ status: 'steps', steps: outcome.steps, done: new Set() });
        await game.refresh();
      } else if (!outcome.ok) {
        setJob({ status: 'failed', stage: 0, message: outcome.message, canRetry: false, charged: outcome.charged });
      }
      return;
    }

    // Full service: walk through the stages while the game does the work.
    let stage = 0;
    setJob({ status: 'running', stage });
    const pace = reducedMotion() ? 150 : 650;
    let finished = false;
    const ticker = (async () => {
      while (!finished && stage < stages.length - 1) {
        await wait(pace);
        if (finished) break;
        stage += 1;
        setJob((j) => (j.status === 'running' ? { status: 'running', stage } : j));
      }
    })();
    const [outcome] = await Promise.all([retry ? retry() : executePlan(game.adapter, arrangement), wait(pace * stages.length)]);
    finished = true;
    await ticker;
    if (outcome.ok) {
      retryRef.current = null;
      setJob({ status: 'running', stage: stages.length });
      await wait(reducedMotion() ? 0 : 400);
      setJob({ status: 'fixed' });
      await game.refresh();
    } else {
      retryRef.current = outcome.retry ?? null;
      setJob({ status: 'failed', stage, message: outcome.message, canRetry: !!outcome.retry, charged: outcome.charged });
    }
  };

  const proceed = () => {
    if (!arrangement) return;
    const due = arrangement.mode === 'full-service' ? arrangement.grandTotal : arrangement.fee;
    if (due > wallet) {
      setPlanError(`Not enough in your wallet. You have ${naira(wallet)} and this costs ${naira(due)}. Lower the budget and make a new plan.`);
      return;
    }
    setPlanError(null);
    void runJob();
  };

  // Screens -----------------------------------------------------------------------

  let screen: JSX.Element | null = null;
  if (step === 'home') {
    screen = <HomeScreen name={player.name} properties={properties} pricing={pricing} onOpen={openProperty} />;
  } else if (step === 'rooms' && property) {
    screen = <RoomsScreen property={property} house={house} error={houseError} onRetry={() => void loadHouse(property)} onPick={pickRoom} />;
  } else if (step === 'purpose' && baseRoom) {
    screen = (
      <PurposeScreen
        room={baseRoom}
        chosen={purposeDraft}
        onChoose={setPurposeDraft}
        onContinue={() => {
          if (!purposeDraft) return;
          setPurposes((p) => ({ ...p, [baseRoom.id]: purposeDraft }));
          setStep('brief');
        }}
      />
    );
  } else if (step === 'brief' && room) {
    screen = (
      <BriefScreen
        room={room}
        brief={brief}
        wallet={wallet}
        budget={budget}
        mode={mode}
        error={briefError}
        suggestedBudget={(base) => scaleBudget(base)}
        onChange={(next) => setBrief((b) => ({ ...b, ...next }))}
        onSubmit={() => void makePlan()}
      />
    );
  } else if (step === 'plan' && room) {
    screen = (
      <PlanScreen
        room={room}
        arrangement={arrangement}
        measuring={measuring}
        items={catalogueById}
        selectedUid={selectedUid}
        onSelect={setSelectedUid}
        error={planError}
        onReroll={reroll}
        onProceed={proceed}
      />
    );
  } else if (step === 'execute' && room && arrangement) {
    if (job.status === 'fixed') {
      screen = <FixedScreen room={room} arrangement={arrangement} items={catalogueById} onDone={() => void goHome()} />;
    } else if (job.status === 'steps') {
      screen = (
        <StepsScreen
          room={room}
          arrangement={arrangement}
          items={catalogueById}
          steps={job.steps}
          done={job.done}
          onToggle={(order) =>
            setJob((j) => {
              if (j.status !== 'steps') return j;
              const done = new Set(j.done);
              if (done.has(order)) done.delete(order);
              else done.add(order);
              return { ...j, done };
            })
          }
          onFinish={() => void goHome()}
        />
      );
    } else {
      const active = job.status === 'running' || job.status === 'failed' ? job.stage : 0;
      screen = (
        <JobScreen
          room={room}
          stages={arrangement.mode === 'full-service' ? stages : [{ label: 'Paying for your plan' }, { label: 'Writing out your steps' }]}
          active={active}
          failed={job.status === 'failed' ? job.message : null}
          canRetry={job.status === 'failed' && job.canRetry}
          onRetry={() => void runJob(retryRef.current ?? undefined)}
        />
      );
    }
  }

  return (
    <>
      <Header onBack={back} wallet={wallet} />
      {screen}
    </>
  );
}
