# Matchvine Refactor + Staggered Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Matchvine from a single 3400-line `index.html` into ES modules with a clean render pipeline, add unit/e2e tests, and implement a staggered bracket layout mode.

**Architecture:** Extract existing working code into ~10 ES module files under `js/`. Replace 4 monkey-patched renderBracket layers with one explicit function. Add Vitest for unit tests (TDD for pure functions) and Playwright for e2e tests. Add staggered layout as a second layout mode in `layout.js`.

**Tech Stack:** Vanilla JS ES modules, Vitest, Playwright, CSS classes (no inline style assignments except positions)

**Spec:** `docs/superpowers/specs/2026-03-22-refactor-and-staggered-layout-design.md`

---

## File Structure

```
index.html              — HTML shell + CSS (no JS except <script type="module" src="js/main.js">)
js/
  main.js               — App initialization, event wiring, imports
  constants.js          — All constants (palette, fonts, sizes, padding)
  state.js              — Data model, factory functions, slot indexing math
  utils.js              — escapeHtml, contrast calc, formatRelativeTime, autoSizeText
  layout.js             — calculateLayout() with full + staggered modes
  render.js             — Single renderBracket() function
  editing.js            — enterEditMode, confirmEdit, exitEditMode
  dialogs.js            — Dialog show/hide/populate, format popover, new bracket
  storage.js            — localStorage, .bracket file export/import
  png-export.js         — Canvas rendering, PNG download
tests/
  unit/
    state.test.js       — Data model + slot indexing tests
    utils.test.js       — Utility function tests
    layout.test.js      — Layout calculation tests (both modes)
  e2e/
    bracket.spec.js     — Playwright e2e tests
  vitest.config.js      — Vitest config
  playwright.config.js  — Playwright config
package.json            — Vitest + Playwright dev dependencies
```

---

## Task 1: Project Setup (Vitest + Playwright + package.json)

**Files:**
- Create: `package.json`
- Create: `tests/vitest.config.js`
- Create: `tests/playwright.config.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "matchvine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "npx playwright test",
    "test:all": "vitest run && npx playwright test"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "@playwright/test": "^1.50.0"
  }
}
```

- [ ] **Step 2: Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
  },
});
```

- [ ] **Step 3: Create playwright.config.js**

```js
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npx serve . -l 3000 -s',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Run: `npx playwright install chromium`

- [ ] **Step 5: Commit**

```
git add package.json tests/ .gitignore
git commit -m "chore: add Vitest + Playwright project setup"
```

---

## Task 2: Extract constants.js (TDD)

**Files:**
- Create: `js/constants.js`
- Create: `tests/unit/constants.test.js`

- [ ] **Step 1: Write failing tests**

Test that `COLOR_PALETTE` has 40 entries, `BRACKET_SIZES` is `[4,8,16,32,64,128]`, `CELL_WIDTH` is 200, `CELL_HEIGHT` is 56, `TEXT_COLORS` has 7 entries, etc.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/constants.test.js`

- [ ] **Step 3: Extract constants from index.html lines ~896-950 into js/constants.js**

Export all constants: `BRACKET_SIZES`, `COLOR_PALETTE`, `TEXT_COLORS`, `DEFAULT_FONTS`, `GOOGLE_FONTS`, `CELL_WIDTH`, `CELL_HEIGHT`, `ROUND_GAP`, `CELL_GAP`, `CHAMP_WIDTH`, `TOP_PADDING`, `LABEL_MARGIN`, `LEFT_PADDING`, `RIGHT_PADDING`.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```
git add js/constants.js tests/unit/constants.test.js
git commit -m "feat: extract constants.js with tests"
```

---

## Task 3: Extract utils.js (TDD)

**Files:**
- Create: `js/utils.js`
- Create: `tests/unit/utils.test.js`

- [ ] **Step 1: Write failing tests**

Test `getLuminance` (white=1, black=0), `getAutoTextColor` (light bg→dark text, dark bg→light text), `getContrastRatio`, `escapeHtml` (escapes <, >, &), `formatRelativeTime` (various time deltas).

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Extract utility functions from index.html into js/utils.js**

Functions: `getLuminance`, `getContrastRatio`, `getAutoTextColor`, `escapeHtml`, `formatRelativeTime`, `generateId`.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```
git add js/utils.js tests/unit/utils.test.js
git commit -m "feat: extract utils.js with tests"
```

---

## Task 4: Extract state.js (TDD)

**Files:**
- Create: `js/state.js`
- Create: `tests/unit/state.test.js`

- [ ] **Step 1: Write failing tests**

Test slot indexing: `getSlotOffset(8,0)=0`, `getSlotOffset(8,1)=8`, `getSlotsInRound(16,0)=16`, `getTotalRounds(8)=4`, `getMatchupPair(8,1,0)=[0,1]`, `getNextSlot(8,0,0)={round:1,index:0}`, `isLeftHalf(16,0,0)=true`, `isLeftHalf(16,0,8)=false`, `getChampionSlotIndex(8)=14`.

Test `createBracket(16,'Test')` returns object with 31 slots, all cellId null, correct fields.

Test `createCell('text','#ff0000')` returns correct cell object with auto text color.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Extract from index.html into js/state.js**

Export: `state` object, `createBracket`, `createCell`, `getSlotOffset`, `getSlotsInRound`, `getTotalRounds`, `getSlotIndex`, `getMatchupPair`, `getNextSlot`, `isLeftHalf`, `getChampionSlotIndex`, `hasTournamentStarted`.

Import `generateId`, `getAutoTextColor` from `utils.js`. Import constants from `constants.js`.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```
git add js/state.js tests/unit/state.test.js
git commit -m "feat: extract state.js with tests"
```

---

## Task 5: Extract layout.js with Classic mode (TDD)

**Files:**
- Create: `js/layout.js`
- Create: `tests/unit/layout.test.js`

- [ ] **Step 1: Write failing tests for Classic layout**

Test `calculateLayout({size:8, layoutMode:'full', ...})`:
- Returns 15 positions (2*8-1)
- Champion position is centered (isChampion: true)
- Left half positions have isLeftHalf: true for round 0 indices 0-3
- Right half positions have isLeftHalf: false for round 0 indices 4-7
- totalWidth and totalHeight are positive
- Round 1+ cells are vertically centered between feeders

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Extract calculateLayout from index.html into js/layout.js**

Move the `calculateLayout` function. Import constants. Export `calculateLayout`. The function checks `bracket.layoutMode` — for now only `'full'` is implemented.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```
git add js/layout.js tests/unit/layout.test.js
git commit -m "feat: extract layout.js with classic mode and tests"
```

---

## Task 6: Add Staggered layout mode (TDD)

**Files:**
- Modify: `js/layout.js`
- Modify: `tests/unit/layout.test.js`

- [ ] **Step 1: Write failing tests for Staggered layout**

Test `calculateLayout({size:8, layoutMode:'staggered', ...})`:
- Returns 15 positions
- Round 0 cells are stacked vertically (same y spacing as classic)
- Round 1 cells have x = round 0 x + CELL_WIDTH + 30, y = midpoint of feeders
- Round 2 cells offset further right, y between their feeders
- Champion is NOT staggered — has a prominent centered position
- totalWidth is significantly less than classic mode
- Right half mirrors the stagger (flows right-to-left toward center)

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement layoutStaggered in layout.js**

Add `layoutStaggered(bracket)` function. Same return shape as `layoutFull`. Champion positioned centered between the two semi-finalists but NOT staggered (placed prominently). Update `calculateLayout` to dispatch based on `bracket.layoutMode`.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```
git add js/layout.js tests/unit/layout.test.js
git commit -m "feat: add staggered layout mode with tests"
```

---

## Task 7: Build render.js (single clean function)

**Files:**
- Create: `js/render.js`

This is the big consolidation task. Read the 4 monkey-patched render layers in `index.html` and combine into one function.

- [ ] **Step 1: Create js/render.js with renderBracket(bracket)**

The function has these explicit steps (each a private helper):
1. `calculateLayout(bracket)` — from layout.js
2. Clear container, create bracket-inner, SVG, cellWrapper
3. `renderCells(positions, bracket, cellWrapper)` — create cell divs with classes/colors/text
4. `renderFormatIcons(bracket, cellWrapper)` — add 🎨 to filled cells
5. `renderPromoteButtons(bracket, cellWrapper)` — add ›/‹ buttons
6. `renderDemoteButtons(bracket, cellWrapper)` — add × badges
7. `renderDraggable(bracket, cellWrapper)` — set draggable on pre-tournament first-round cells
8. `renderConnectorLines(positions, bracket, svg)` — draw SVG lines
9. `renderLabels(positions, bracket, cellWrapper)` — round labels + seed numbers + title
10. `updateToolbarState(bracket)` — shuffle button disabled state, title text
11. `saveBracket(bracket)` — persist to localStorage

Import from: `layout.js`, `state.js`, `constants.js`, `utils.js`, `storage.js`.

Use CSS classes, not inline styles, for all visual states. Only set `style.left`, `style.top`, `style.width`, `style.backgroundColor`, `style.color` inline (computed values).

- [ ] **Step 2: Verify autoSizeText is a utility in render.js**

Keep `autoSizeText(cellDiv)` as a private function in render.js. It uses `display: block` on `.cell-text`, NOT flex.

- [ ] **Step 3: Commit**

```
git add js/render.js
git commit -m "feat: create clean render.js — single renderBracket function"
```

---

## Task 8: Extract editing.js

**Files:**
- Create: `js/editing.js`

- [ ] **Step 1: Extract editing functions from index.html**

Export: `enterEditMode(slotIndex)`, `confirmEdit()`, `exitEditMode()`, `setupEditingEvents(container)`.

`enterEditMode` modifies DOM directly — does NOT call renderBracket for empty cells. Creates cell in data model, applies color to existing DOM element, focuses immediately.

`setupEditingEvents(container)` sets up the click delegation on the bracket container and click-outside-to-confirm listener.

Import from: `state.js`, `constants.js`, `render.js` (for confirmEdit to call renderBracket after confirming).

- [ ] **Step 2: Commit**

```
git add js/editing.js
git commit -m "feat: extract editing.js"
```

---

## Task 9: Extract dialogs.js

**Files:**
- Create: `js/dialogs.js`

- [ ] **Step 1: Extract all dialog code from index.html**

Export: `showDialog(id)`, `hideDialog(id)`, `hideAllDialogs()`, `openSettingsDialog()`, `openSeedDialog()`, `openBracketsDialog()`, `openNewBracketDialog()`, `showFormatPopover(slotIndex)`, `hideFormatPopover()`, `setupDialogEvents()`.

This includes: settings dialog (size, background, seed numbers, font picker), seed dialog (textarea, preview, import), brackets list dialog (list, switch, delete, new), format popover (color grid, positioning), new bracket dialog.

Import from: `state.js`, `constants.js`, `render.js`, `storage.js`, `utils.js`.

- [ ] **Step 2: Commit**

```
git add js/dialogs.js
git commit -m "feat: extract dialogs.js"
```

---

## Task 10: Extract storage.js

**Files:**
- Create: `js/storage.js`

- [ ] **Step 1: Extract storage code from index.html**

Export: `saveBracket(bracket)`, `loadBracket(id)`, `loadBracketIndex()`, `deleteBracketFromStorage(id)`, `downloadBracketFile(bracket)`, `handleBracketFileLoad(file, callback)`.

Pure localStorage + file I/O functions. No DOM manipulation.

- [ ] **Step 2: Commit**

```
git add js/storage.js
git commit -m "feat: extract storage.js"
```

---

## Task 11: Extract png-export.js

**Files:**
- Create: `js/png-export.js`

- [ ] **Step 1: Extract PNG export code from index.html**

Export: `exportPNG(bracket)`.

Contains `renderBracketToCanvas(bracket)` as a private function. Uses Canvas 2D API to draw the bracket. Imports `calculateLayout` from layout.js.

- [ ] **Step 2: Commit**

```
git add js/png-export.js
git commit -m "feat: extract png-export.js"
```

---

## Task 12: Create main.js + wire everything together

**Files:**
- Create: `js/main.js`
- Modify: `index.html` — strip all `<script>` JS, add `<script type="module" src="js/main.js">`

- [ ] **Step 1: Create js/main.js**

Imports all modules. Initializes the app:
- Load bracket from localStorage or show new bracket dialog
- Call renderBracket
- Set up all event listeners via: `setupEditingEvents()`, `setupDialogEvents()`, toolbar button listeners (promote, demote, drag-drop, export PNG, shuffle)
- Set up window resize handler

- [ ] **Step 2: Strip JS from index.html**

Remove the entire `<script>...</script>` block from index.html. Replace with:
```html
<script type="module" src="js/main.js"></script>
```

Keep all HTML and CSS in index.html.

- [ ] **Step 3: Add layout mode toggle to Settings dialog HTML**

Add "Layout" section to the settings dialog HTML with two toggle buttons: "Classic" and "Compact".

- [ ] **Step 4: Test in browser**

Open index.html in browser. Verify:
- Bracket renders
- Cell editing works (click, type, Enter accepts, Escape cancels)
- Color popover works
- Promote/demote works
- Settings dialog works
- Seed import works
- Shuffle works
- Brackets list works
- Save/Load .bracket works
- Export PNG works
- Layout toggle switches between classic and staggered

- [ ] **Step 5: Commit**

```
git add js/main.js index.html
git commit -m "feat: wire up main.js, strip JS from index.html, add layout toggle"
```

---

## Task 13: Write Playwright E2E Tests

**Files:**
- Create: `tests/e2e/bracket.spec.js`

- [ ] **Step 1: Write e2e tests**

Tests:
1. Create bracket: open page → fill title → pick size → click Create → verify cells rendered
2. Edit cell: click cell → type "Abbey Road" → press Enter → verify text displayed
3. Multi-cell edit: edit cell 1 → Enter → edit cell 2 → Enter → both persist
4. Seed import: click Seed → paste names → Import → verify cells filled with colors
5. Promote: fill two cells → click promote → verify winner in next round
6. Demote: promote → click × → verify cleared
7. Color popover: hover cell → click 🎨 → click color → verify change
8. Layout toggle: open Settings → click Compact → verify different layout → click Classic → verify original
9. Persistence: edit cells → reload → verify data persisted

- [ ] **Step 2: Run e2e tests**

Run: `npx playwright test`

- [ ] **Step 3: Commit**

```
git add tests/e2e/bracket.spec.js
git commit -m "test: add Playwright e2e tests"
```

---

## Task 14: CSS Cleanup

**Files:**
- Modify: `index.html` (CSS section)
- Modify: `js/render.js` (remove inline style assignments where possible)

- [ ] **Step 1: Audit render.js for inline style assignments**

Replace `element.style.X = Y` with CSS classes wherever possible. Keep only:
- `style.left`, `style.top` (computed positions)
- `style.width` (champion cell)
- `style.backgroundColor`, `style.color` (cell-specific colors from data model)

Move all other styling to CSS classes in index.html.

- [ ] **Step 2: Run all tests**

Run: `npm run test:all`

- [ ] **Step 3: Commit**

```
git add index.html js/render.js
git commit -m "refactor: move inline styles to CSS classes"
```

---

## Task 15: Final Cleanup + Remove Dead Code

**Files:**
- Modify: various js/ files

- [ ] **Step 1: Remove console.log debug statements**

Search all JS files for `console.log` and remove debugging statements.

- [ ] **Step 2: Remove unused functions**

Check for dead code: `getBracketRegions`, `scaleToFit`, any other unused functions from the region focus feature that was removed.

- [ ] **Step 3: Run all tests**

Run: `npm run test:all`

- [ ] **Step 4: Take Playwright screenshots to verify visual correctness**

Compare against earlier screenshots.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "chore: remove debug logging and dead code"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Project setup (Vitest, Playwright, package.json) | None |
| 2 | Extract constants.js (TDD) | 1 |
| 3 | Extract utils.js (TDD) | 1 |
| 4 | Extract state.js (TDD) | 2, 3 |
| 5 | Extract layout.js — Classic mode (TDD) | 2, 4 |
| 6 | Add Staggered layout mode (TDD) | 5 |
| 7 | Build render.js (consolidate 4 monkey-patches) | 2, 3, 4, 5 |
| 8 | Extract editing.js | 4, 7 |
| 9 | Extract dialogs.js | 4, 7 |
| 10 | Extract storage.js | 4 |
| 11 | Extract png-export.js | 5, 7 |
| 12 | Create main.js + strip index.html JS | All above |
| 13 | Playwright e2e tests | 12 |
| 14 | CSS cleanup | 12 |
| 15 | Final cleanup + dead code removal | All above |
