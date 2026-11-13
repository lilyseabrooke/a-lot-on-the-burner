import { ChartColumn, CircleHelp, Flame, Pencil, Settings2 } from 'lucide-react';
import { animate, LayoutGroup, motion, MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_RANK, MIN_RANK } from '../engine/intensity';
import { analyse, comboIds, type PuzzleData } from '../engine/puzzle';
import { SLOTS, type Ingredient, type Slot } from '../engine/types';
import { puzzleNumberFor } from '../game/date';
import { cancelSample, DEBUG_ENABLED, loadDebugRank, makeSample, saveDebugRank, SampleCancelled } from '../game/sample';
import { computeStats } from '../game/stats';
import { loadSave, newDay, settingsOf, writeSave, type DayRecord, type SaveFile, type Settings } from '../game/storage';
import { BrewButton } from './BrewButton';
import { ClueCard, ClueList } from './ClueLog';
import { DebugBar } from './DebugBar';
import { fx, setSoundEnabled } from './fx';
import { HelpSheet, WelcomeSheet } from './HelpSheet';
import { CluesSheet, ConfirmSheet, StatsSheet } from './MiscSheets';
import { PRESS_SCALE, spring } from './motion';
import { ResultSheet } from './ResultSheet';
import { SettingsSheet } from './Settings';
import { Shelves, SORTS, type SortKey } from './Shelves';
import { FLIP_STAGGER, Slots } from './Slots';
import { useIsWide, usePrefersDark } from './useMedia';

type SheetName = 'welcome' | 'help' | 'stats' | 'settings' | 'confirm' | 'result' | 'clues' | null;
type Load = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; puzzle: PuzzleData };
type Point = { x: number; y: number };
/** A throwaway debug puzzle with its own in-memory progress, kept apart from the saved daily record and stats. */
type Sample = { puzzle: PuzzleData; record: DayRecord; seed: number; hit: boolean };

async function fetchPuzzle(n: number): Promise<PuzzleData | null> {
  if (n < 1) return null;
  const res = await fetch(`/puzzles/${n}.json`);
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
  const data = (await res.json()) as PuzzleData;
  return data.format === 1 ? data : null;
}

/** Keep the browser chrome in step with the page background. Must match --c-bg in app.css. */
const THEME_COLOR = { light: '#f3eee2', dark: '#101118' };

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      className="icon-button"
      onClick={() => {
        fx('tap');
        onClick();
      }}
      aria-label={label}
      whileTap={{ scale: 0.86 }}
      transition={spring.snappy}
    >
      {children}
    </motion.button>
  );
}

export function App() {
  const [today, setToday] = useState(() => puzzleNumberFor(new Date()));
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [save, setSave] = useState<SaveFile>(loadSave);
  const [sheet, setSheet] = useState<SheetName>(() => (save.seenHelp ? null : 'welcome'));
  const [sort, setSort] = useState<SortKey>('name');
  const [tab, setTab] = useState<Slot>('base');
  const [tabDir, setTabDir] = useState(1);
  const [notes, setNotes] = useState(false);
  const [drag, setDrag] = useState<{ slot: Slot; hover: { slot: Slot; ok: boolean } | null } | null>(null);
  const [flipping, setFlipping] = useState(false);
  const slotEls = useRef<Partial<Record<Slot, HTMLDivElement | null>>>({});
  const timers = useRef<number[]>([]);
  const [sample, setSample] = useState<Sample | null>(null);
  const [debugRank, setDebugRank] = useState(() => loadDebugRank(MIN_RANK, MAX_RANK));
  const [sampling, setSampling] = useState(false);
  const [sampleError, setSampleError] = useState<string>();
  const sampleRequest = useRef(0);

  const wide = useIsWide();
  const prefersDark = usePrefersDark();
  const settings = settingsOf(save);
  const theme = settings.theme === 'auto' ? (prefersDark ? 'dark' : 'light') : settings.theme;

  useEffect(() => writeSave(save), [save]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.house = settings.house;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme, settings.house]);

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);

  // Roll over to the new puzzle if the page is left open past midnight.
  useEffect(() => {
    const check = () => setToday(puzzleNumberFor(new Date()));
    const timer = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoad({ state: 'loading' });
    fetchPuzzle(today)
      .catch(() => null)
      .then((puzzle) => {
        if (!cancelled) setLoad(puzzle ? { state: 'ready', puzzle } : { state: 'missing' });
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const puzzle = sample ? sample.puzzle : load.state === 'ready' ? load.puzzle : null;
  const analysis = useMemo(() => (puzzle ? analyse(puzzle) : null), [puzzle]);
  const inSample = sample !== null;
  const record = sample ? sample.record : (save.days[today] ?? newDay());
  const stats = useMemo(() => computeStats(save, today), [save, today]);
  const finished = record.status !== 'playing';
  const ready = SLOTS.every((s) => record.placed[s]);

  const update = useCallback(
    (fn: (r: DayRecord) => DayRecord) => {
      if (inSample) setSample((s) => s && { ...s, record: fn(s.record) });
      else setSave((s) => ({ ...s, days: { ...s.days, [today]: fn(s.days[today] ?? newDay()) } }));
    },
    [today, inSample],
  );

  const changeSettings = (patch: Partial<Settings>) => {
    if (patch.sound !== undefined) setSoundEnabled(patch.sound);
    setSave((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  };

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  /** Drops everything tied to the puzzle on screen (pending animations, open sheet, tab, notes) before swapping puzzles. */
  const resetBoard = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setFlipping(false);
    setDrag(null);
    setNotes(false);
    setTab('base');
    setSheet(null);
  };

  const newSample = async () => {
    const request = ++sampleRequest.current;
    setSampling(true);
    setSampleError(undefined);
    try {
      const made = await makeSample(debugRank);
      if (request !== sampleRequest.current) return;
      resetBoard();
      setSample({ puzzle: made.puzzle, record: newDay(), seed: made.seed, hit: made.hit });
    } catch (err) {
      if (err instanceof SampleCancelled || request !== sampleRequest.current) return;
      setSampleError(err instanceof Error ? err.message : 'Could not make a sample puzzle.');
    } finally {
      if (request === sampleRequest.current) setSampling(false);
    }
  };

  const backToDaily = () => {
    sampleRequest.current++;
    cancelSample();
    setSampling(false);
    setSampleError(undefined);
    resetBoard();
    setSample(null);
  };

  const changeDebugRank = (rank: number) => {
    setDebugRank(rank);
    saveDebugRank(rank);
  };

  const goTab = (slot: Slot) => {
    setTabDir(SLOTS.indexOf(slot) >= SLOTS.indexOf(tab) ? 1 : -1);
    setTab(slot);
  };

  const place = (ing: Ingredient) => {
    const slot = ing.slot;
    fx('place');
    update((r) => ({ ...r, placed: { ...r.placed, [slot]: ing.id } }));
    // Move on to the next empty slot's shelf, after a beat so the landing reads.
    const next = SLOTS.find((s) => s !== slot && !record.placed[s]);
    if (next && tab === slot) later(320, () => goTab(next));
  };

  const remove = (slot: Slot) => {
    fx('remove');
    goTab(slot); // so the tile has a shelf to fly back to
    update((r) => ({ ...r, placed: { ...r.placed, [slot]: undefined } }));
  };

  const cross = (id: string) => {
    fx(record.crossed.includes(id) ? 'restore' : 'crossOut');
    update((r) => ({ ...r, crossed: r.crossed.includes(id) ? r.crossed.filter((c) => c !== id) : [...r.crossed, id] }));
  };

  const reveal = () => puzzle && update((r) => ({ ...r, revealed: Math.min(puzzle.clues.length, r.revealed + 1) }));

  const slotAt = ({ x, y }: Point): Slot | null => {
    const cx = x - window.scrollX;
    const cy = y - window.scrollY;
    const pad = 14;
    for (const s of SLOTS) {
      const r = slotEls.current[s]?.getBoundingClientRect();
      if (r && cx >= r.left - pad && cx <= r.right + pad && cy >= r.top - pad && cy <= r.bottom + pad) return s;
    }
    return null;
  };

  const dragMove = (ing: Ingredient, pt: Point) => {
    const s = slotAt(pt);
    const hover = s ? { slot: s, ok: s === ing.slot } : null;
    setDrag((d) => (d && d.hover?.slot === hover?.slot ? d : { slot: ing.slot, hover }));
  };

  const drop = (ing: Ingredient, pt: Point) => {
    setDrag(null);
    const s = slotAt(pt);
    if (s === ing.slot) place(ing);
    else if (s) {
      fx('reject');
      const el = slotEls.current[s];
      if (el) animate(el, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.34 });
    }
  };

  const brew = () => {
    if (!puzzle || !analysis) return;
    const { base, catalyst, binder } = record.placed;
    if (!base || !catalyst || !binder) return;
    const guess: [string, string, string] = [base, catalyst, binder];
    const ids = comboIds(analysis.solution);
    const won = ids.every((id, i) => id === guess[i]);
    setSheet(null);
    setFlipping(true);
    update((r) => ({ ...r, status: won ? 'won' : 'lost', guess, minClues: analysis.minClues, intensity: puzzle.intensity }));
    guess.forEach((id, i) => later(i * FLIP_STAGGER * 1000 + 250, () => fx(id === ids[i] ? 'slotCorrect' : 'slotWrong')));
    const end = SLOTS.length * FLIP_STAGGER * 1000 + 300;
    later(end, () => fx(won ? 'win' : 'lose'));
    later(end + 650, () => {
      setFlipping(false);
      setSheet('result');
    });
  };

  const closeSheet = () => {
    if ((sheet === 'welcome' || sheet === 'help') && !save.seenHelp) setSave((s) => ({ ...s, seenHelp: true }));
    setSheet(null);
  };

  const clueProps = puzzle && analysis && {
    clues: puzzle.clues,
    revealed: record.revealed,
    finished,
    minClues: analysis.minClues,
    onReveal: reveal,
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={`app${DEBUG_ENABLED ? ' has-debug' : ''}`}>
        <header className="topbar">
          <IconButton label="Settings" onClick={() => setSheet('settings')}>
            <Settings2 size={21} aria-hidden />
          </IconButton>
          <div className="title">
            <h1 className="wordmark">A Lot on the Burner</h1>
            {puzzle && (
              <p className="title-meta">
                {sample ? 'Sample' : `No. ${puzzle.number}`}
                <span className="rank" title="Intensity Rank">
                  <Flame size={12} strokeWidth={2.6} aria-hidden />
                  <span className="sr-only">Intensity Rank</span>
                  {puzzle.intensity}
                </span>
              </p>
            )}
          </div>
          <div className="topbar-right">
            <IconButton label="How to play" onClick={() => setSheet('help')}>
              <CircleHelp size={21} aria-hidden />
            </IconButton>
            <IconButton label="Statistics" onClick={() => setSheet('stats')}>
              <ChartColumn size={21} aria-hidden />
            </IconButton>
          </div>
        </header>

        {DEBUG_ENABLED && (
          <DebugBar
            rank={debugRank}
            onRank={changeDebugRank}
            busy={sampling}
            inSample={inSample}
            missedWith={sample && !sample.hit ? sample.puzzle.intensity : undefined}
            error={sampleError}
            onNew={newSample}
            onBackToDaily={backToDaily}
          />
        )}

        {!sample && load.state === 'loading' && <p className="notice">Warming the burner…</p>}
        {!sample && load.state === 'missing' && (
          <div className="notice">
            <h2>The burner is cold</h2>
            <p>There is no potion to brew today. Check back soon.</p>
          </div>
        )}

        {puzzle && analysis && clueProps && (
          <main className="stage" key={sample ? `sample-${sample.seed}` : 'daily'}>
            {wide && (
              <aside className="side-clues" aria-label="Clues">
                <div className="side-head">
                  <h2 className="eyebrow">Clues</h2>
                  <span className="side-count">{record.revealed} revealed</span>
                </div>
                <ClueList {...clueProps} withReveal />
              </aside>
            )}
            <div className="game">
              {!wide && <ClueCard {...clueProps} onShowAll={() => setSheet('clues')} />}
              <LayoutGroup>
                <Slots
                  record={record}
                  solution={analysis.solution}
                  activeTab={tab}
                  hover={drag?.hover ?? null}
                  dragSlot={drag?.slot ?? null}
                  flipping={flipping}
                  register={(s, el) => (slotEls.current[s] = el)}
                  onRemove={remove}
                  onSelect={(s) => {
                    fx('tab');
                    goTab(s);
                  }}
                />
                <Shelves
                  available={puzzle.available}
                  placed={record.placed}
                  crossed={record.crossed}
                  locked={finished}
                  notes={notes}
                  tab={tab}
                  tabDir={tabDir}
                  sort={sort}
                  onTab={goTab}
                  onSort={() => setSort((k) => SORTS[(SORTS.indexOf(k) + 1) % SORTS.length])}
                  onPlace={place}
                  onCross={cross}
                  onDragStart={(ing) => setDrag({ slot: ing.slot, hover: null })}
                  onDragMove={dragMove}
                  onDrop={drop}
                />
              </LayoutGroup>
              <div className="actions">
                {finished ? (
                  <motion.button
                    type="button"
                    className="button primary results-button"
                    onClick={() => setSheet('result')}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: flipping ? 0 : 1, y: flipping ? 12 : 0 }}
                    whileTap={{ scale: PRESS_SCALE }}
                    transition={spring.bouncy}
                  >
                    {record.status === 'won' ? 'The potion holds' : 'The potion curdled'} · Results
                  </motion.button>
                ) : (
                  <>
                    <motion.button
                      type="button"
                      className={`notes-toggle${notes ? ' is-on' : ''}`}
                      aria-pressed={notes}
                      aria-label="Notes mode: tap ingredients to rule them out"
                      onClick={() => {
                        fx(notes ? 'notesOff' : 'notesOn');
                        setNotes((n) => !n);
                      }}
                      whileTap={{ scale: 0.88 }}
                      transition={spring.bouncy}
                    >
                      <motion.span animate={{ rotate: notes ? -20 : 0, y: notes ? -2 : 0 }} transition={spring.bouncy} style={{ display: 'grid' }}>
                        <Pencil size={20} aria-hidden />
                      </motion.span>
                    </motion.button>
                    <BrewButton
                      ready={ready}
                      onBrew={brew}
                      onNotReady={() => {
                        const empty = SLOTS.find((s) => !record.placed[s]);
                        if (empty) goTab(empty);
                      }}
                      onConfirmFallback={() => setSheet('confirm')}
                    />
                  </>
                )}
              </div>
            </div>
          </main>
        )}

        <WelcomeSheet open={sheet === 'welcome'} onClose={closeSheet} house={settings.house} onHouse={(house) => changeSettings({ house })} />
        <HelpSheet open={sheet === 'help'} onClose={closeSheet} />
        <SettingsSheet open={sheet === 'settings'} onClose={closeSheet} settings={settings} onChange={changeSettings} />
        <StatsSheet open={sheet === 'stats'} onClose={closeSheet} stats={stats} />
        {clueProps && <CluesSheet open={sheet === 'clues'} onClose={closeSheet} {...clueProps} />}
        <ConfirmSheet
          open={sheet === 'confirm'}
          placed={record.placed}
          revealed={record.revealed}
          onCancel={closeSheet}
          onConfirm={() => {
            fx('brew');
            brew();
          }}
        />
        {puzzle && analysis && (
          <ResultSheet
            open={sheet === 'result'}
            onClose={closeSheet}
            label={sample ? 'Sample' : `No. ${puzzle.number}`}
            intensity={puzzle.intensity}
            record={record}
            solution={analysis.solution}
            minClues={analysis.minClues}
            stats={inSample ? null : stats}
            onNextSample={inSample ? newSample : undefined}
          />
        )}
      </div>
    </MotionConfig>
  );
}

