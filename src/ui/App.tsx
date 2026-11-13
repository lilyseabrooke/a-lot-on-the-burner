import { ChartColumn, CircleHelp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { analyse, comboIds, type PuzzleData } from '../engine/puzzle';
import { ingredient } from '../engine/roster';
import type { Ingredient, Slot } from '../engine/types';
import { puzzleNumberFor } from '../game/date';
import { computeStats } from '../game/stats';
import { loadSave, newDay, writeSave, type DayRecord, type SaveFile } from '../game/storage';
import { BrewStation } from './BrewStation';
import { ClueLog } from './ClueLog';
import { ConfirmModal } from './ConfirmModal';
import { HelpModal } from './HelpModal';
import { ResultModal } from './ResultModal';
import { Shelves, type SortKey } from './Shelves';
import { StatsModal } from './StatsModal';

type ModalName = 'help' | 'stats' | 'confirm' | 'result' | null;
type Load = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; puzzle: PuzzleData };

async function fetchPuzzle(n: number): Promise<PuzzleData | null> {
  if (n < 1) return null;
  const res = await fetch(`/puzzles/${n}.json`);
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
  const data = (await res.json()) as PuzzleData;
  return data.format === 1 ? data : null;
}

export function App() {
  const [today, setToday] = useState(() => puzzleNumberFor(new Date()));
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [save, setSave] = useState<SaveFile>(loadSave);
  const [modal, setModal] = useState<ModalName>(() => (save.seenHelp ? null : 'help'));
  const [sort, setSort] = useState<SortKey>('name');
  const [dragging, setDragging] = useState<Ingredient | null>(null);

  useEffect(() => writeSave(save), [save]);

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

  const puzzle = load.state === 'ready' ? load.puzzle : null;
  const analysis = useMemo(() => (puzzle ? analyse(puzzle) : null), [puzzle]);
  const record = save.days[today] ?? newDay();
  const stats = useMemo(() => computeStats(save, today), [save, today]);
  const finished = record.status !== 'playing';

  const update = useCallback(
    (fn: (r: DayRecord) => DayRecord) =>
      setSave((s) => ({ ...s, days: { ...s.days, [today]: fn(s.days[today] ?? newDay()) } })),
    [today],
  );

  const place = (slot: Slot, id: string) =>
    update((r) => ({ ...r, placed: { ...r.placed, [slot]: r.placed[slot] === id ? undefined : id } }));
  const clear = (slot: Slot) => update((r) => ({ ...r, placed: { ...r.placed, [slot]: undefined } }));
  const cross = (id: string) =>
    update((r) => ({ ...r, crossed: r.crossed.includes(id) ? r.crossed.filter((c) => c !== id) : [...r.crossed, id] }));
  const reveal = () =>
    puzzle && update((r) => ({ ...r, revealed: Math.min(puzzle.clues.length, r.revealed + 1) }));

  const brew = () => {
    if (!puzzle || !analysis) return;
    const { base, catalyst, binder } = record.placed;
    if (!base || !catalyst || !binder) return;
    const guess: [string, string, string] = [base, catalyst, binder];
    const won = comboIds(analysis.solution).every((id, i) => id === guess[i]);
    update((r) => ({
      ...r,
      status: won ? 'won' : 'lost',
      guess,
      minClues: analysis.minClues,
      intensity: puzzle.intensity,
    }));
    setModal('result');
  };

  const closeModal = () => {
    if (modal === 'help' && !save.seenHelp) setSave((s) => ({ ...s, seenHelp: true }));
    setModal(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">
            {puzzle ? (
              <>
                No. {puzzle.number} <span className="sep">·</span> Intensity Rank{' '}
                <span className="intensity">{puzzle.intensity}</span>
              </>
            ) : (
              'Daily alchemy'
            )}
          </p>
          <h1 className="wordmark">A Lot on the Burner</h1>
        </div>
        <nav className="topbar-actions" aria-label="Game menu">
          <button type="button" className="icon-button" onClick={() => setModal('help')} aria-label="How to play">
            <CircleHelp size={20} aria-hidden />
          </button>
          <button type="button" className="icon-button" onClick={() => setModal('stats')} aria-label="Statistics">
            <ChartColumn size={20} aria-hidden />
          </button>
        </nav>
      </header>

      {load.state === 'loading' && <p className="notice">Warming the burner…</p>}
      {load.state === 'missing' && (
        <div className="notice">
          <h2 className="section-title">The burner is cold</h2>
          <p>There is no potion to brew today. Check back soon.</p>
        </div>
      )}

      {puzzle && analysis && (
        <main className="layout">
          <div className="workbench">
            <BrewStation
              record={record}
              solution={analysis.solution}
              dragging={dragging}
              onDrop={(slot, id) => ingredient(id).slot === slot && update((r) => ({ ...r, placed: { ...r.placed, [slot]: id } }))}
              onClear={clear}
              onBrew={() => setModal('confirm')}
            />
            {finished && (
              <button type="button" className="button button-secondary result-button" onClick={() => setModal('result')}>
                {record.status === 'won' ? 'The potion holds' : 'The potion curdled'} · see results
              </button>
            )}
            <ClueLog
              clues={puzzle.clues}
              revealed={record.revealed}
              finished={finished}
              minClues={analysis.minClues}
              onReveal={reveal}
            />
          </div>
          <Shelves
            available={puzzle.available}
            placed={record.placed}
            crossed={record.crossed}
            locked={finished}
            sort={sort}
            onSort={setSort}
            onPlace={(ing) => place(ing.slot, ing.id)}
            onCross={cross}
            onDragStart={setDragging}
            onDragEnd={() => setDragging(null)}
          />
        </main>
      )}

      <HelpModal open={modal === 'help'} onClose={closeModal} />
      <StatsModal open={modal === 'stats'} onClose={closeModal} stats={stats} />
      <ConfirmModal
        open={modal === 'confirm'}
        placed={record.placed}
        revealed={record.revealed}
        onCancel={closeModal}
        onConfirm={brew}
      />
      {puzzle && analysis && (
        <ResultModal
          open={modal === 'result'}
          onClose={closeModal}
          number={puzzle.number}
          intensity={puzzle.intensity}
          record={record}
          solution={analysis.solution}
          minClues={analysis.minClues}
          stats={stats}
        />
      )}
    </div>
  );
}
