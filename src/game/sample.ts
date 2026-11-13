import type { RankResult } from '../engine/generator';
import type { SampleRequest, SampleResponse } from './sampleWorker';

/*
 * Debug "sample puzzles": brew a throwaway puzzle at a chosen Intensity Rank, in the browser, to test how a
 * rank feels. Sample puzzles live only in memory. They are never saved and never touch stats.
 *
 * The debug bar shows in `npm run dev`, or on any build when the URL has ?debug (e.g. a Vercel preview).
 */

export const DEBUG_ENABLED: boolean = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');

const RANK_KEY = 'a-lot-on-the-burner:debug-rank';
export const DEFAULT_DEBUG_RANK = 15;

export function loadDebugRank(minRank: number, maxRank: number): number {
  try {
    const n = Number(localStorage.getItem(RANK_KEY));
    if (Number.isInteger(n) && n >= minRank && n <= maxRank) return n;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_DEBUG_RANK;
}

export function saveDebugRank(rank: number): void {
  try {
    localStorage.setItem(RANK_KEY, String(rank));
  } catch {
    /* storage unavailable */
  }
}

export class SampleCancelled extends Error {}

let current: { worker: Worker; cancel: () => void } | null = null;

/** Generates a sample puzzle in a worker. Starting a new one cancels any still running (its promise rejects with SampleCancelled). */
export function makeSample(rank: number): Promise<RankResult> {
  current?.cancel();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./sampleWorker.ts', import.meta.url), { type: 'module' });
    const done = () => {
      worker.terminate();
      if (current?.worker === worker) current = null;
    };
    current = {
      worker,
      cancel: () => {
        done();
        reject(new SampleCancelled());
      },
    };
    worker.onmessage = (e: MessageEvent<SampleResponse>) => {
      done();
      if (e.data.ok) resolve(e.data);
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      done();
      reject(new Error(e.message || 'The sample worker failed.'));
    };
    const request: SampleRequest = { rank, seed: Math.floor(Math.random() * 2 ** 31) };
    worker.postMessage(request);
  });
}

export function cancelSample(): void {
  current?.cancel();
}
