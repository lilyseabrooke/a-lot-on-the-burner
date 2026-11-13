/*
 * Runs the puzzle generator off the main thread: hitting a specific rank can take a few seconds
 * (it retries seeds), which would freeze the game if done in the page. Only loaded by sample.ts.
 */
import { generateAtRank, type RankResult } from '../engine/generator';

export interface SampleRequest {
  rank: number;
  seed: number;
}
export type SampleResponse = ({ ok: true } & RankResult) | { ok: false; error: string };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<SampleRequest>) => void) | null;
  postMessage(message: SampleResponse): void;
};

ctx.onmessage = (e) => {
  try {
    ctx.postMessage({ ok: true, ...generateAtRank(e.data.rank, e.data.seed) });
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
