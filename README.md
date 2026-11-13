# A Lot on the Burner

A daily alchemy puzzle set in the Starfall Academy universe. Each day you brew one potion from a **base**, a **catalyst** and a **binder**. You start with one clue and can reveal more, but you only get one brew. If you brew correctly, the game shows how your clue count compared with the puzzle's hidden **minimum**: the point in the clue sequence after which only one potion fits.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # engine + stats tests, and re-validates every puzzle in public/puzzles
npm run build      # type-check and build to dist/
```

Deploys to Vercel as a static Vite site, with no server or environment variables. Vercel detects the settings automatically: build command `npm run build`, output directory `dist`.

## How it fits together

```
src/engine/     pure puzzle logic, shared by the app and the scripts
  types.ts        slots, origins, ingredients
  roster.ts       the fixed ingredient list (placeholder names)
  clues.ts        every clue type: how it's checked, how it reads, how abstract it is
  puzzle.ts       stored puzzle format + solver (works out the answer and minimum from the clues)
  generator.ts    builds a puzzle aimed at a target Intensity Rank
  intensity.ts    the Intensity Rank formula
src/game/       browser-side state: puzzle numbering, localStorage save, stats, debug sample puzzles (sample.ts + worker)
src/ui/         React components (motion for animation, drag and sheets)
  fx.ts           every sound and haptic, by name (placeholder synth sounds)
  motion.ts       shared spring presets
src/styles/     Starfall design tokens (copied from starfall-academy) + app styles, themes and House accents
scripts/        generate.ts (writes daily puzzles), calibrate.ts (tuning report), make-puzzle.ts (debug: print one puzzle at a chosen rank)
public/puzzles/ one JSON file per day, fetched by number
```

### Puzzles

Puzzles are generated ahead of time and committed to the repo (`public/puzzles/<n>.json`). Once a day's puzzle exists, it doesn't change, even if the generator does. Puzzle No. 1 is the date in `src/config.ts` (`EPOCH`), and the number counts up at each player's local midnight. If no file exists for a day, the game shows a "burner is cold" notice.

```bash
npm run generate                               # fill in any missing puzzles 1–365
npm run generate -- --to 730                   # extend the run
npm run generate -- --from 1 --to 365 --force  # regenerate (e.g. before launch, after roster changes)
```

Puzzle files store the available ingredients, the clue sequence and the Intensity Rank, but not the answer. The client works out the answer and the minimum from the clues. A determined player could still solve it from the file, which is acceptable for a small audience.

**Debug: sample puzzles in the browser.** Run `npm run dev` (or add `?debug` to the URL of any build, such as a Vercel preview) and a debug bar appears under the header: a rank slider (5–30) and a **New puzzle** button. Each press brews a fresh throwaway puzzle at exactly that rank, so you can play lots of them and feel how a rank plays. The header says "Sample" instead of a puzzle number. Sample puzzles live only in memory: they never touch your saved game, streaks or stats, and finishing one offers an **Another sample** button. The back arrow returns to today's puzzle. The generator runs in a Web Worker (hitting an exact rank can take a few seconds), and the chosen rank is remembered between visits.

**Debug: make a puzzle at a specific rank.** `npm run puzzle -- --rank 18` generates a fresh puzzle at exactly that Intensity Rank (5–30) and prints the shelf size, the answer, and every clue with the number of potions left, marking the minimum, duds and helpers. It retries with new seeds until the rank matches exactly.

```bash
npm run puzzle -- --rank 18                      # new random puzzle (prints its seed)
npm run puzzle -- --rank 18 --seed 7             # reproducible
npm run puzzle -- --rank 18 --json               # also print the stored JSON
npm run puzzle -- --rank 18 --write 400          # save as public/puzzles/400.json (add --force to overwrite)
```

Other flags: `--tries N` (seed attempts, default 200) and `--allow-miss` (accept the closest rank instead of exiting with an error). Nothing is written to disk unless `--write` is given, and a missed rank is never written.

### Generation

1. Choose a target Intensity Rank for the day. Most days are 5–20, and about 8% are above 20.
2. Choose 6–12 ingredients per slot, with larger sets on harder days and an occasional heavily restricted shelf. Then pick a secret solution.
3. List every clue that is true of the solution.
4. Pick clues one at a time. Most rule out at least one remaining combination. The clue that leaves exactly one potion is the minimum, and there are always at least 3 clues up to that point. Harder targets prefer more abstract clues and narrow the field more slowly.
   - Some clues before the minimum are **duds**: true, but everything they would rule out is already gone. A dud either confirms something you could already work out ("The base is not natural" once every natural base is eliminated) or looks useful but adds nothing. Duds can appear at any rank but become more common as it rises: about 1 in 8 puzzles at ranks 5–10, about 1 in 2 at 11–15, and one or two per puzzle above 15. There are at most 2 per puzzle, never two in a row, never as the free first clue, and never as the clue that reaches the minimum.
   - A clue that merely restates a single earlier clue ("The total weight is at least 8" after "…at least 16") is never used.
5. After the minimum, add increasingly direct helper clues ("The binder is one of A, B or C", then naming each slot) so a stuck player can always finish.

### Intensity Rank

`rank = Σ (1.5 + 0.3 × level)` over the clues up to the minimum (duds included, since the player still has to work through them), plus `0.8 × (log₂(combinations) − log₂(216))`, clamped to 5–30. Clue levels:

| Level | Examples |
|---|---|
| 1 | The base is not extraplanar · Moonwax is not in the potion · The base weighs at least 6 |
| 2 | The catalyst is heavier than every other component · No component is demonic · The base and the binder share an origin |
| 3 | Contract Ink cannot be paired with a natural binder · The total weight is odd · The base's weight is greater than its volatility |
| 4 | The binder and the catalyst have weights of different parity · If the base is natural, the binder is not demonic |
| 5 | A natural base cannot account for more than a third of the total weight |

Comparison clues are worded so ties are never ambiguous ("heavier than every other component" or "no lighter than any other component").

`npm run calibrate -- 400` prints the rank and minimum-clue distributions for a batch of generated puzzles. Use it after changing weights or clue types.

### Replacing the placeholder roster

Edit the names in `src/engine/roster.ts`. Puzzles reference ingredients by id, so renaming is always safe. Changing an origin, weight or volatility can break existing puzzles. `npm test` re-checks every puzzle file and will flag any that broke. Before launch, simply regenerate with `--force`.

### Look and feel

The game fits on one phone screen with no page scroll: a clue card at the top, three slots, a tabbed shelf and a hold-to-brew button. On screens 960px and wider the clue history moves into a side panel.

- **Tiles** are pressable keycaps. Tap to place, drag onto a slot, tap a filled slot to send the tile back. Long-press (or right-click) rules an ingredient out; the pencil button turns on notes mode, where a tap rules out instead of placing.
- **Hold to brew** is the confirmation, so there is no dialog. A click with no hold (e.g. from a screen reader) falls back to a confirm sheet.
- After brewing, the slots flip over one by one, then the results sheet slides up.
- Animation respects `prefers-reduced-motion`.

**Themes and Houses.** Players choose Light, Dark or Auto, and a House that sets the accent colour: Dragon (violet), Eagle (crimson), Scorpion (gold, the default), Boar (forest) and Dolphin (teal). Both are attributes on `<html>` (`data-theme`, `data-house`) and every colour is a CSS variable in `src/styles/app.css`. A small script in `index.html` applies them before first paint.

### Sound

All sounds are placeholders, synthesised in `src/ui/fx.ts`. Each one is named after the moment it plays (`place`, `reject`, `reveal`, `holdTick`, `slotCorrect`, `win`, …); the `FxName` type lists them all with a comment saying where each is used. To replace one with a designed sound, change its entry in `SOUNDS`. Haptics (`navigator.vibrate`) sit alongside in `HAPTICS`; they work on Android and are ignored by iOS Safari. Sound can be switched off in settings.

### Saved data

Everything is stored in one `localStorage` key (`a-lot-on-the-burner:v1`): each day's revealed clues, crossed-out ingredients, placed ingredients and result, plus the player's settings (theme, House, sound). Streaks, win rate and the minimum distribution are worked out from that. If storage is blocked, the game still plays; it just doesn't remember.
