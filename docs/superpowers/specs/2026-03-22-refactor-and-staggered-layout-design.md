# Matchvine Refactor + Staggered Layout Design

## Overview

Refactor the single-file `index.html` into ES modules with clean separation of concerns, eliminate monkey-patching in the render pipeline, add unit and e2e tests, and introduce a "Staggered" bracket layout mode alongside the existing "Classic" layout.

## Goals

1. **Clean code**: Replace 4 monkey-patched `renderBracket` layers with one explicit function
2. **ES modules**: Split into focused files with clear boundaries
3. **CSS discipline**: All styling via CSS classes, not inline JS style assignments (except computed positions)
4. **Testing**: Vitest unit tests (TDD for pure functions), Playwright e2e tests
5. **Staggered layout**: New layout mode where next-round cells sit between their feeders vertically

## Module Structure

```
index.html          — HTML shell + CSS + <script type="module" src="js/main.js">
js/
  main.js           — Imports all modules, initializes app, wires events
  constants.js      — COLOR_PALETTE, FONTS, BRACKET_SIZES, CELL_WIDTH/HEIGHT, etc.
  state.js          — createBracket(), createCell(), generateId(), slot indexing math
  render.js         — renderBracket() — one function, explicit steps, no monkey-patching
  layout.js         — calculateLayout(bracket) dispatching to layoutFull() or layoutStaggered()
  editing.js        — enterEditMode(), confirmEdit(), exitEditMode()
  dialogs.js        — All dialog show/hide/populate logic
  storage.js        — saveBracket(), loadBracket(), file export/import
  png-export.js     — renderBracketToCanvas(), PNG download
  utils.js          — escapeHtml(), getLuminance(), getAutoTextColor(), formatRelativeTime()
tests/
  unit/             — Vitest tests for pure functions
  e2e/              — Playwright tests for user flows
```

## Render Pipeline (render.js)

One exported function: `renderBracket(bracket)`

Steps, in order:
1. Get layout positions from `calculateLayout(bracket)`
2. Clear `#bracket-container`, create `#bracket-inner`, SVG, cellWrapper
3. Render cells: create div per slot, apply CSS classes and colors, wrap text in `.cell-text` span
4. Apply `autoSizeText()` to each cell
5. Add format icons (🎨) to filled cells
6. Add promote buttons (›/‹) where both matchup cells are filled and next slot is empty — or single cell for bye
7. Add demote buttons (×) on promoted cells in round > 0
8. Draw SVG connector lines
9. Render round labels, seed numbers
10. Render bracket title on canvas
11. Update toolbar state (shuffle button, etc.)
12. Call `saveBracket()` to persist

No monkey-patching. Each step is a private helper within `render.js`.

## Editing (editing.js)

`enterEditMode(slotIndex)`:
- Modifies DOM directly — does NOT call renderBracket()
- For empty cells: creates Cell in data model, applies color to existing DOM element
- Sets contenteditable on .cell-text, focuses immediately
- Attaches keydown handler (capture phase) for Enter/Escape

`confirmEdit()`:
- Extracts text from contenteditable innerHTML
- Trims whitespace — empty text deletes the cell
- Calls `renderBracket()` to refresh display

`exitEditMode()`:
- Removes cell-editing class, sets contenteditable false
- Clears editing state

## Layout Modes (layout.js)

Both modes export the same data shape:
```
{ positions: [{slotIndex, round, indexInRound, x, y, isLeftHalf, isChampion}],
  posMap: {}, totalWidth, totalHeight, championX }
```

### Classic ("full") Mode
Current columnar layout. Left half flows left→right, right half flows right→left, champion centered. Each round occupies its own vertical column.

### Staggered ("compact") Mode
Each next-round cell positioned vertically between its two feeders with a smaller horizontal offset:
- Round 0: stacked vertically (same as classic)
- Round 1+: x = previous round x + CELL_WIDTH + small gap (~30px), y = midpoint of two feeders
- Connector lines: straight from feeder edge to next-round cell edge
- Champion: NOT staggered — stays in a prominent centered position, connected to the two semi-finalists

### Settings
- `bracket.layoutMode`: `'full'` (default) or `'staggered'`
- Toggle in Settings dialog: "Classic" / "Compact" buttons
- Changing mode re-renders immediately
- Existing brackets without `layoutMode` default to `'full'`

## CSS Discipline

All visual states managed via CSS classes:
- `.cell`, `.cell-empty`, `.cell-editing`, `.cell-winner`, `.cell-loser`, `.cell-champion`
- `.cell-text` — `display: block; text-align: center;` (NOT flex — breaks contenteditable)
- `.format-icon`, `.promote-btn`, `.demote-btn` — positioned via CSS, shown/hidden via `:hover`
- `.popover-below` — flips popover arrow when positioned below cell
- `.bracket-title-display` — large centered title on canvas

JS only sets:
- `style.left` / `style.top` — computed absolute positions from layout
- `style.width` on champion cell (wider than standard)
- `style.backgroundColor` / `style.color` — cell-specific colors from data model
- Class toggling via `classList.add/remove`

## Data Model Changes

Add to Bracket object:
- `layoutMode: 'full'` — default for new brackets, preserved on save/load

No other model changes.

## Testing

### Unit Tests (Vitest, TDD)
- `state.test.js`: createBracket (correct slot count, structure), createCell, generateId uniqueness
- `layout.test.js`: calculateLayout for both modes — correct positions, correct dimensions, all sizes (4-128)
- `utils.test.js`: getLuminance, getAutoTextColor (dark/light bg), getContrastRatio, escapeHtml, formatRelativeTime
- `indexing.test.js`: getSlotOffset, getSlotsInRound, getTotalRounds, getMatchupPair, getNextSlot, isLeftHalf, getChampionSlotIndex — test all bracket sizes

### E2E Tests (Playwright)
- Create bracket flow: open → title → size → create → verify cells rendered
- Edit cell: click → type → Enter → verify text saved and displayed
- Edit + navigate: edit cell 1 → Enter → edit cell 2 → Enter → both persist
- Seed import: open seed dialog → paste names → import → verify cells filled
- Promote/demote: fill two cells → promote → verify track → demote → verify cleared
- Color popover: hover → click 🎨 → pick color → verify cell color changes
- Layout toggle: switch to staggered → verify layout changes → switch back
- PNG export: click export → verify download triggered
- Persistence: edit cells → reload page → verify data persisted

## Migration Strategy

Extract existing working code into modules, one module at a time:
1. `constants.js` — extract constants
2. `utils.js` — extract utility functions
3. `state.js` — extract data model + slot math
4. `layout.js` — extract calculateLayout, add staggered mode
5. `render.js` — consolidate 4 monkey-patches into one function
6. `editing.js` — extract editing code
7. `dialogs.js` — extract dialog code
8. `storage.js` — extract persistence code
9. `png-export.js` — extract PNG code
10. `main.js` — wire everything together
11. `index.html` — strip JS, keep HTML + CSS, add `<script type="module">`

Test after each step to ensure nothing breaks.
