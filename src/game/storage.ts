import type { Slot } from '../engine/types';

/*
 * Everything a player has done lives in one localStorage entry. Access can
 * throw (private mode, blocked storage), so every read and write is guarded and
 * the game still plays without it — it just won't remember.
 */

export type DayStatus = 'playing' | 'won' | 'lost';

export interface DayRecord {
  revealed: number;
  crossed: string[];
  placed: Partial<Record<Slot, string>>;
  status: DayStatus;
  /** Filled in once the potion is brewed. */
  guess?: [string, string, string];
  minClues?: number;
  intensity?: number;
}

export type House = 'dragon' | 'eagle' | 'scorpion' | 'boar' | 'dolphin';
export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface Settings {
  theme: ThemeChoice;
  house: House;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'auto', house: 'scorpion', sound: true };

export interface SaveFile {
  version: 1;
  days: Record<string, DayRecord>;
  seenHelp?: boolean;
  /** Added with the redesign; older saves simply don't have it and get the defaults. */
  settings?: Partial<Settings>;
}

export function settingsOf(save: SaveFile): Settings {
  return { ...DEFAULT_SETTINGS, ...save.settings };
}

export const SAVE_KEY = 'a-lot-on-the-burner:v1';

export function emptySave(): SaveFile {
  return { version: 1, days: {} };
}

export function loadSave(): SaveFile {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as SaveFile;
    if (parsed?.version !== 1 || typeof parsed.days !== 'object') return emptySave();
    return parsed;
  } catch {
    return emptySave();
  }
}

export function writeSave(save: SaveFile): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable: play on without saving */
  }
}

export function newDay(): DayRecord {
  return { revealed: 1, crossed: [], placed: {}, status: 'playing' };
}
