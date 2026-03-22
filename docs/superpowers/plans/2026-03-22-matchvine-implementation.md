# Matchvine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone single-page HTML tournament bracket maker with convergent March Madness-style layout, cell tracks, color customization, localStorage persistence, and PNG export.

**Architecture:** Single `index.html` file with embedded CSS and JS. No build step, no framework. Only external dependency is Google Fonts loaded on demand. State managed via a plain JS object that auto-saves to localStorage.

**Tech Stack:** Vanilla HTML/CSS/JS, Canvas API for PNG export, Google Fonts API, localStorage

**Spec:** `docs/superpowers/specs/2026-03-22-matchvine-design.md`

---

## File Structure

This is a single-file app. All code lives in `index.html`. The file is organized into these logical sections:

```
index.html
├── <style>         — All CSS (layout, cells, toolbar, dialogs, colors)
├── <body>          — Toolbar, bracket container, dialogs (seed, settings, brackets list, formatting popover)
└── <script>        — All JS, organized as:
    ├── Constants    — Color palette, font list, bracket sizes
    ├── State        — Data model, state management, auto-save
    ├── Indexing     — Slot/round math, half detection, matchup pairing
    ├── Rendering    — Bracket layout, cells, connector lines, region focus
    ├── Interaction  — Cell editing, promote/demote, drag-and-drop
    ├── Dialogs      — Settings, seed, brackets list, formatting popover
    ├── Storage      — localStorage read/write, file export/import
    ├── PNG Export   — Canvas rendering and download
    └── Init         — Startup, event listeners
```

Additionally:
- `docs/superpowers/specs/2026-03-22-matchvine-design.md` — Design spec (already exists)
- `.gitignore` — Already exists

---

## Task 1: HTML Skeleton + CSS Foundation

**Files:**
- Create: `index.html`

Set up the page structure, toolbar HTML, bracket container, and all base CSS. No JS yet — just the static shell.

- [ ] **Step 1: Create index.html with DOCTYPE, head, and meta tags**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Matchvine — Tournament Bracket Maker</title>
  <style>
    /* CSS goes here — added in next steps */
  </style>
</head>
<body>
  <!-- HTML goes here — added in next steps -->
  <script>
    // JS goes here — added in later tasks
  </script>
</body>
</html>
```

- [ ] **Step 2: Add toolbar HTML**

Inside `<body>`, add the toolbar with all buttons. The toolbar contains: app name, editable bracket title, Seed button, Shuffle button, Settings button, Export PNG button, Save Bracket button, Load Bracket button, Brackets list button. The bracket title should be a `contenteditable` span. Shuffle button starts with a `disabled` class. Include a hidden file input for Load Bracket.

- [ ] **Step 3: Add bracket container and dialog placeholders**

Below the toolbar, add:
- `<div id="bracket-container">` — the main bracket rendering area
- `<div id="seed-dialog" class="dialog hidden">` — seed modal with textarea, preview count, and Import button
- `<div id="settings-dialog" class="dialog hidden">` — settings modal with bracket size toggles, font picker grid, background color palette, seed numbers toggle
- `<div id="brackets-dialog" class="dialog hidden">` — saved brackets list modal with bracket entries and New button
- `<div id="format-popover" class="popover hidden">` — formatting popover with background color grid, text color row, auto-contrast checkbox
- `<div id="dialog-overlay" class="hidden">` — semi-transparent backdrop for modals

- [ ] **Step 4: Write all base CSS**

In the `<style>` tag, write CSS for:
- Reset/base: `* { box-sizing: border-box; margin: 0; padding: 0; }`, body font, background
- Toolbar: flexbox row, centered vertically, gap between items, subtle bottom border. Buttons styled as light gray bordered pills with icon + text. Bracket title styled as inline-editable text.
- Bracket container: fills remaining viewport height below toolbar, `overflow: hidden`, `position: relative`
- Dialog/modal: centered overlay, white background, rounded corners (12px), shadow, max-width 420px. `.hidden` class: `display: none`. Overlay: fixed position, semi-transparent black.
- Popover: absolute positioned, white background, rounded corners, shadow, arrow pointing down
- Cell base styles: rounded rect (8px radius), fixed dimensions (150px wide, 48px tall), `cursor: pointer`, transition on border/shadow
- Cell states: `.cell-hover` (blue border), `.cell-editing` (blue glow + thicker border), `.cell-empty` (light gray bg, "?" text), `.cell-winner` (green border), `.cell-loser` (50% opacity)
- Promote/demote buttons: small rounded squares, positioned at cell edges
- Format icon (🎨): absolute positioned top-right of cell, hidden by default, shown on cell hover
- Color palette grid: 8-column CSS grid of square color swatches
- Connector lines: styled via SVG (will be drawn in JS)
- Utility classes: `.hidden`, `.disabled` (grayed out, pointer-events none)

- [ ] **Step 5: Open in browser and verify layout**

Open `index.html` in a browser. Verify:
- Toolbar renders across the top with all buttons visible
- Bracket container fills remaining space
- No console errors

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add HTML skeleton and CSS foundation"
```

---

## Task 2: Constants + Data Model + State Management

**Files:**
- Modify: `index.html` (script section)

Implement the core data structures, state management, and slot indexing math.

- [ ] **Step 1: Define constants**

In the `<script>` tag, add:
- `BRACKET_SIZES`: array `[4, 8, 16, 32, 64, 128]`
- `COLOR_PALETTE`: array of ~40 hex color strings organized as described in the spec (pastels, medium, vivid, light tints, neutrals). No super-dark colors.
- `TEXT_COLORS`: array of ~7 hex colors for manual text color selection (black, dark gray, gray, white, navy, dark red, dark green)
- `DEFAULT_FONTS`: array of objects `{ name, family, category }` for ~5 system fallback fonts (sans-serif, serif, monospace, cursive, system-ui)
- `GOOGLE_FONTS`: array of ~15-20 font name strings to be loaded from Google Fonts on demand (e.g., "Inter", "Roboto", "Lato", "Merriweather", "Playfair Display", "Oswald", "Raleway", "Nunito", "Poppins", "Bebas Neue", "Pacifico", "Bangers", "Permanent Marker", "Fredoka One", "Righteous")
- `CELL_WIDTH`: 150, `CELL_HEIGHT`: 48
- `ROUND_GAP`: 60 (horizontal gap between rounds)
- `CELL_GAP`: 8 (vertical gap between cells in same round)

- [ ] **Step 2: Implement state object and core functions**

Create the central state object and functions:
- `state` object: `{ bracket: null }` — holds the current bracket
- `generateId()`: returns a timestamp + random suffix string
- `createBracket(size, title)`: creates a new Bracket object with all slots initialized as empty (`cellId: null`). Total slots = `2 * size - 1`. Assigns `id`, `title`, `titleFont: 'sans-serif'`, `size`, `backgroundColor: '#ffffff'`, `showSeedNumbers: true`, `createdAt`, `updatedAt`, empty `cells` map, `zoomState: { focused: false, region: null }`. Returns the bracket object.
- `createCell(text, bgColor)`: creates a Cell with `id`, `text`, `textColor` (auto-calculated from bgColor), `bgColor`, `sourceSlot: null`. Returns the cell object.

- [ ] **Step 3: Implement slot indexing functions**

These are the math utilities that everything else depends on:
- `getSlotOffset(size, round)`: returns the starting index in the flat slots array for a given round. Round 0 starts at 0, round 1 at `size`, round 2 at `size + size/2`, etc.
- `getSlotsInRound(size, round)`: returns how many slots are in a given round. Round 0 has `size` slots, round 1 has `size/2`, etc.
- `getTotalRounds(size)`: returns `Math.log2(size) + 1` (including the champion round which has 1 slot)
- `getSlotIndex(size, round, indexInRound)`: returns the flat array index for a slot at a given round and position
- `getMatchupPair(size, round, indexInRound)`: returns the two slot indices from the previous round that feed into this slot. For the left half, the pair at round R index I feeds from round R-1 indices I*2 and I*2+1. Right half mirrors this.
- `getNextSlot(size, round, indexInRound)`: returns the round and index of the slot this one promotes into
- `isLeftHalf(size, round, indexInRound)`: returns true if this slot is in the left half of the bracket
- `getChampionSlotIndex(size)`: returns the flat index of the final champion slot (last slot in the array)

- [ ] **Step 4: Implement contrast calculation**

- `getLuminance(hexColor)`: converts hex to relative luminance per WCAG 2.1
- `getContrastRatio(color1, color2)`: returns contrast ratio between two colors
- `getAutoTextColor(bgColor)`: returns `'#1a1a1a'` (dark) if bg is light, `'#ffffff'` (white) if bg is dark. Uses 4.5:1 contrast threshold.

- [ ] **Step 5: Verify in browser console**

Open `index.html`, open the browser console, and test:
- `createBracket(8, 'Test')` returns a valid bracket object with 15 slots
- `getSlotOffset(8, 0)` returns 0, `getSlotOffset(8, 1)` returns 8
- `getSlotsInRound(8, 0)` returns 8, `getSlotsInRound(8, 1)` returns 4
- `getAutoTextColor('#ffffff')` returns dark, `getAutoTextColor('#1a1a1a')` returns white

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add constants, data model, and slot indexing math"
```

---

## Task 3: Bracket Rendering (Convergent Layout)

**Files:**
- Modify: `index.html` (script section + bracket container)

Render the bracket as a convergent March Madness layout with cells and connector lines. This is the visual core of the app.

- [ ] **Step 1: Implement layout position calculator**

Write `calculateLayout(bracket)` which returns an array of position objects, one per slot:
```
{ slotIndex, round, indexInRound, x, y, isLeftHalf, isChampion }
```

Layout logic:
- The bracket container is divided into left half and right half with the champion cell in the center
- Left half: round 0 is on the far left, rounds advance rightward. Only the top half of round-0 slots (indices 0 to size/2-1) belong to the left side.
- Right half: round 0 is on the far right, rounds advance leftward. Bottom half of round-0 slots (indices size/2 to size-1) belong to the right side.
- Within each half, cells in round R are vertically centered between their two feeder cells from round R-1
- Champion slot is centered horizontally and vertically
- Use `CELL_WIDTH`, `CELL_HEIGHT`, `ROUND_GAP`, `CELL_GAP` constants for spacing
- Return the total width and height needed as well, for sizing the container

- [ ] **Step 2: Implement cell rendering**

Write `renderBracket(bracket)` which:
- Calls `calculateLayout(bracket)` to get positions
- Clears the bracket container
- Creates an SVG element sized to the full bracket dimensions for connector lines
- For each slot, creates a `<div>` with class `cell` positioned absolutely at (x, y)
- If slot has a cellId, looks up the cell in `bracket.cells` and displays its text, bgColor, textColor
- If slot is empty, shows the empty state (light gray, "?")
- If slot is the champion, adds the champion styling (gold border, wider, trophy icon)
- Adds `data-slot-index`, `data-round`, `data-index` attributes to each cell div for later interaction

- [ ] **Step 3: Implement connector line rendering**

Within `renderBracket`, after placing cells, draw SVG connector lines:
- For each slot in rounds 1+, find its two feeder slots from the previous round
- Draw the bracket connector: horizontal line from each feeder cell edge → vertical line joining them → horizontal line to the current slot
- Left-half connectors: lines go from right edge of feeder cells toward center
- Right-half connectors: lines go from left edge of feeder cells toward center
- Lines are thin gray (`stroke: #9ca3af`, `stroke-width: 1.5`)
- Champion slot connectors come from both the left semi-final and the right semi-final

- [ ] **Step 4: Implement round labels**

Below (or at the bottom of) each round column, render labels: "Round 1", "Round 2", ..., "Semis", "Final". Position them centered under each column of cells. Use the round count to determine names — the second-to-last round is "Semis", the last is "Final".

- [ ] **Step 5: Implement seed number display**

If `bracket.showSeedNumbers` is true, render small gray seed numbers beside each first-round cell. Left-half cells get the number on their left edge. Right-half cells get it on their right edge. Numbers are `#1`, `#2`, etc. in the traditional seeding order.

- [ ] **Step 6: Initialize and render a default bracket on page load**

At the bottom of the script, add initialization:
- `state.bracket = createBracket(16, 'New Bracket')`
- Call `renderBracket(state.bracket)`
- Set up the toolbar title to show the bracket's title

- [ ] **Step 7: Open in browser and verify**

Verify:
- A 16-slot convergent bracket renders with left and right halves
- Empty cells show as gray rounded rectangles with "?"
- Connector lines form the classic bracket tree shape
- Champion slot is centered with gold border
- Round labels appear at the bottom
- Seed numbers appear beside first-round cells

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: render convergent bracket layout with cells and connectors"
```

---

## Task 4: Cell Text Editing

**Files:**
- Modify: `index.html` (script section)

Make cells clickable and editable with text input support.

- [ ] **Step 1: Implement cell click-to-edit**

Add click event handling to the bracket container (event delegation):
- When a cell div is clicked (not the format icon or promote button), enter edit mode
- Edit mode: set `contenteditable="true"` on a text span inside the cell, add `.cell-editing` class, focus the element, place cursor at end of text
- Track which cell is currently being edited in state: `state.editingSlotIndex`

- [ ] **Step 2: Implement keyboard handling for editing**

When a cell is in edit mode:
- **Enter**: confirm edit — read the innerHTML, update the Cell's text in the bracket data, call `renderBracket()`, exit edit mode
- **Shift+Enter**: insert a `<br>` line break, stay in edit mode
- **Escape**: cancel edit — revert text to what it was before editing, exit edit mode
- **Click outside**: same as Enter — confirm and exit
- Use a `beforeEditText` variable to store the text before editing starts, for Escape revert

- [ ] **Step 3: Implement text auto-sizing**

Write `autoSizeText(cellDiv)`:
- Start at a base font size (16px)
- Measure the text content against the cell dimensions (CELL_WIDTH - padding, CELL_HEIGHT - padding)
- If it overflows, reduce font size by 1px and re-measure
- Stop at a minimum floor of 9px
- Apply the computed font size to the cell's text element
- Call this after rendering each cell and after edit confirmation

- [ ] **Step 4: Handle creating new cells on empty slot edit**

When the user clicks an empty slot and starts typing:
- Create a new Cell with empty text and a random color from `COLOR_PALETTE`
- Assign the cell to the slot
- Enter edit mode immediately

- [ ] **Step 5: Verify in browser**

- Click an empty cell → cursor appears, can type text
- Press Enter → text is saved, cell shows with random background color
- Press Escape → edit is cancelled
- Shift+Enter → line break inserted
- Long text auto-shrinks to fit the cell
- Click outside → edit confirmed

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add cell text editing with auto-sizing"
```

---

## Task 5: Color Formatting Popover

**Files:**
- Modify: `index.html` (script section + popover HTML)

Implement the 🎨 icon and formatting popover for per-cell background and text colors.

- [ ] **Step 1: Show 🎨 icon on cell hover**

In `renderBracket`, add a format icon element inside each filled cell div:
```html
<span class="format-icon">🎨</span>
```
CSS already hides it by default and shows it on `.cell:hover .format-icon`. Make sure clicking the icon does NOT trigger cell edit mode (use `event.stopPropagation()`).

- [ ] **Step 2: Implement popover positioning and show/hide**

When the format icon is clicked:
- Get the cell's bounding rect
- Position the `#format-popover` above the cell, centered horizontally
- If the popover would go off-screen at top, position it below instead
- Show the popover, store the current slot index in `state.formattingSlotIndex`
- Clicking outside the popover or pressing Escape dismisses it

- [ ] **Step 3: Populate background color palette in popover**

Render the `COLOR_PALETTE` as an 8-column grid of square swatches inside the popover's background section. The currently selected color gets a blue border. Clicking a swatch:
- Updates the Cell's `bgColor`
- If auto-contrast is on, recalculates and updates `textColor`
- Re-renders the bracket (all slots showing this cell update because of the track)
- Updates the selected indicator in the palette

- [ ] **Step 4: Populate text color row in popover**

Render `TEXT_COLORS` as a row of larger swatches. Include an "Auto contrast" checkbox, checked by default. Currently selected color gets a blue border.
- When a text color swatch is clicked: update Cell's `textColor`, uncheck auto-contrast, re-render
- When auto-contrast is checked: recalculate text color from current bgColor, re-render
- When auto-contrast is unchecked: leave current text color as-is

- [ ] **Step 5: Verify in browser**

- Hover over a filled cell → 🎨 icon appears
- Click icon → popover appears above cell with full color palette
- Click a background color → cell updates immediately, all track instances update
- Click a text color → text color changes
- Toggle auto-contrast → text color adjusts to background
- Click outside → popover dismisses

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add color formatting popover with palette and auto-contrast"
```

---

## Task 6: Promote and Demote

**Files:**
- Modify: `index.html` (script section)

Implement the core tournament mechanic: promoting winners and demoting mistakes.

- [ ] **Step 1: Implement promote buttons in rendering**

In `renderBracket`, for each pair of filled cells in a matchup where the next-round slot is empty:
- Left-half cells: add a `›` button on the right edge of each cell
- Right-half cells: add a `‹` button on the left edge of each cell
- Buttons are small rounded squares with the arrow character
- Buttons have `data-action="promote"` and `data-slot-index` attributes
- Do NOT show promote buttons if either cell in the pair is empty

- [ ] **Step 2: Implement promote logic**

When a promote button is clicked:
- Get the slot index from the button's data attribute
- Find the Cell in that slot
- Find the next-round slot using `getNextSlot()`
- Set the next-round slot's `cellId` to the same Cell ID (this is the track — shared data)
- Mark the winning cell's slot div with `.cell-winner` (green border, checkmark)
- Mark the losing cell's slot div with `.cell-loser` (50% opacity)
- Hide promote buttons for this matchup
- Re-render the bracket
- Update `bracket.updatedAt`

- [ ] **Step 3: Implement demote button in rendering**

In `renderBracket`, for each slot in rounds > 0 that has a cellId:
- Add a small red `×` badge, hidden by default, shown on hover
- Badge has `data-action="demote"` and `data-slot-index` attributes
- Only show on slots where the cell was promoted INTO (not the original first-round slot)

- [ ] **Step 4: Implement demote logic**

When the demote button is clicked:
- Get the slot index
- Set that slot's `cellId` to `null`
- The cell still exists in earlier-round slots (track shrinks by one)
- Remove winner/loser styling from the previous-round matchup pair
- Re-show promote buttons for the previous-round matchup if both feeder cells are still filled
- Re-render the bracket
- Update `bracket.updatedAt`

- [ ] **Step 5: Implement tournament-started detection**

Write `hasTournamentStarted(bracket)`: returns true if any slot in round > 0 has a cellId. This is used by shuffle and drag-and-drop to know if they should be disabled.

- [ ] **Step 6: Verify in browser**

- Fill two adjacent first-round cells with text → promote buttons appear
- Click promote → cell appears in next round with same color, winner styled green, loser faded
- Hover on promoted cell → red × appears
- Click × → cell removed from that round, previous matchup promote buttons reappear
- Edit text on any instance → all track instances update

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add promote and demote with cell track system"
```

---

## Task 7: Drag and Drop (Pre-Tournament)

**Files:**
- Modify: `index.html` (script section)

Implement drag-and-drop for rearranging first-round cells before the tournament starts.

- [ ] **Step 1: Make first-round cells draggable**

In `renderBracket`, if `!hasTournamentStarted(bracket)`:
- Set `draggable="true"` on all first-round cell divs that have a cellId
- Add `dragstart` handler: store the source slot index in `dataTransfer`, add a `.dragging` class for visual feedback (semi-transparent), set drag image to a ghost of the cell

- [ ] **Step 2: Implement drag-over and drop targets**

All first-round cell divs (empty or filled) are valid drop targets:
- `dragover` handler: prevent default (to allow drop), add `.drop-target` highlight class
- `dragleave` handler: remove `.drop-target` class
- `drop` handler: read the source slot index from `dataTransfer`

- [ ] **Step 3: Implement drop logic**

On drop:
- If target slot is empty: move the source cell to the target slot (set target's cellId to source's cellId, clear source's cellId)
- If target slot is filled: swap — store both cellIds, then cross-assign them
- Update cell `sourceSlot` fields to reflect new positions
- Re-render the bracket
- Update `bracket.updatedAt`

- [ ] **Step 4: Disable drag-and-drop once tournament starts**

After any promote action, re-render removes `draggable` from cells since `hasTournamentStarted()` returns true.

- [ ] **Step 5: Verify in browser**

- Drag a filled cell to an empty slot → cell moves
- Drag a filled cell to another filled cell → they swap
- Promote a winner → cells are no longer draggable

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add pre-tournament drag-and-drop with swap"
```

---

## Task 8: Toolbar Title Editing + Settings Dialog

**Files:**
- Modify: `index.html` (script section)

Wire up the toolbar title and the bracket settings dialog.

- [ ] **Step 1: Implement inline title editing**

The bracket title in the toolbar is a `contenteditable` span:
- On focus: select all text
- On blur or Enter: save the new title to `bracket.title`, update `bracket.updatedAt`
- On Escape: revert to previous title

- [ ] **Step 2: Implement settings dialog open/close**

- Settings button click → show `#settings-dialog` and `#dialog-overlay`
- Close button (✕) or overlay click → hide both
- Escape key → close dialog

- [ ] **Step 3: Implement bracket size selection**

In the settings dialog, render size toggle buttons from `BRACKET_SIZES`. Highlight the current size. On click:
- If same size, do nothing
- If bracket has any data (any cells), show confirmation: "Changing size will clear all bracket data. Continue?"
- If confirmed or bracket is empty: call `createBracket(newSize, bracket.title)` preserving title, font, background, and seed number settings. Set as current bracket. Re-render.

- [ ] **Step 4: Implement bracket background color selection**

Render a row of ~7 background color options (whites, light grays, soft tints). Highlight current. On click:
- Update `bracket.backgroundColor`
- Apply to bracket container's background style
- Re-render

- [ ] **Step 5: Implement seed numbers toggle**

Render a toggle switch for `bracket.showSeedNumbers`. On toggle:
- Update the bracket property
- Re-render (seed numbers appear/disappear)

- [ ] **Step 6: Verify in browser**

- Click title → can edit, Enter saves, Escape reverts
- Open settings → dialog appears with current values
- Change bracket size → confirmation if data exists, bracket resets
- Change background → bracket background updates
- Toggle seed numbers → numbers appear/disappear

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add title editing and settings dialog"
```

---

## Task 9: Google Fonts Integration

**Files:**
- Modify: `index.html` (script section + settings dialog)

Add the font picker to the settings dialog with on-demand Google Fonts loading.

- [ ] **Step 1: Implement font loading utility**

Write `loadGoogleFont(fontName)`:
- Check if the font is already loaded (maintain a `Set` of loaded fonts)
- If not, create a `<link>` element: `href="https://fonts.googleapis.com/css2?family=FONT_NAME:wght@400;600;700&display=swap"`
- Append to `<head>`
- Add font name to the loaded set
- Return a Promise that resolves when the font is ready (use `document.fonts.ready` or a timeout fallback)

- [ ] **Step 2: Render font picker grid in settings dialog**

Display `DEFAULT_FONTS` and `GOOGLE_FONTS` in a 2-column grid. Each option shows:
- Font name in its own font
- "The quick brown fox" preview text in that font
- Current font highlighted with blue border
- System fonts render immediately. Google Fonts show in system font initially.

- [ ] **Step 3: Lazy-load font previews**

Use an `IntersectionObserver` on the font grid items:
- When a Google Font item scrolls into view, call `loadGoogleFont()` for that font
- Once loaded, update the preview text to use the actual font
- This avoids loading all 15-20 fonts at once

- [ ] **Step 4: Implement font selection**

When a font is clicked:
- Load the font if not already loaded
- Set `bracket.titleFont` to the font family string
- Apply the font to the bracket title and all cells
- Re-render the bracket
- Update `bracket.updatedAt`

- [ ] **Step 5: Implement "More fonts..." expansion**

Initially show the first 6 fonts (mix of system + popular Google). A "More fonts..." button at the end of the grid expands to show all options.

- [ ] **Step 6: Load bracket font on startup**

When loading a bracket from localStorage or file, if its `titleFont` is a Google Font, call `loadGoogleFont()` before rendering.

- [ ] **Step 7: Verify in browser**

- Open settings → font grid shows with previews
- Scroll in font list → fonts lazy-load their previews
- Click a Google Font → bracket updates to that font
- Reload page → saved font loads and renders correctly

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: add Google Fonts picker with on-demand loading"
```

---

## Task 10: Seed Dialog

**Files:**
- Modify: `index.html` (script section)

Implement the seed import functionality.

- [ ] **Step 1: Implement seed dialog open/close**

Seed button click → show `#seed-dialog` and `#dialog-overlay`. Close on ✕, overlay click, or Escape.

- [ ] **Step 2: Implement live preview count**

As the user types or pastes in the textarea:
- Parse non-blank lines
- Count available empty first-round slots in the current bracket
- Display: "N names → N of M slots will be filled" (or warning if too many)

- [ ] **Step 3: Implement import logic**

When "Import" button is clicked:
- Parse the textarea: split by newlines, filter out blank lines, trim each line
- Find all empty first-round slots in traditional seeding order. For a 16-slot bracket: positions are arranged so #1 vs #16, #8 vs #9, #5 vs #12, #4 vs #13, etc. The first name in the list is seed #1 and goes to the #1 position, the second name is seed #2 and goes to the #2 position, etc. Implement `getSeedOrder(size)` which returns the slot indices in traditional seeding order (this ensures high seeds are spread across the bracket, not clustered together).
- For each name, create a Cell with the name as text, a random color from `COLOR_PALETTE`, and auto-contrast text color
- Assign each Cell to the next empty slot in the seed order
- If more names than slots, truncate (the preview already warned)
- Close the dialog, re-render the bracket
- Update `bracket.updatedAt`

- [ ] **Step 4: Verify in browser**

- Open seed dialog → textarea and preview count visible
- Paste a list of names → count updates live
- Click Import → names appear in first-round cells with random colors
- Open again, paste more → fills into remaining empty slots (incremental)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add seed dialog with incremental import"
```

---

## Task 11: Shuffle

**Files:**
- Modify: `index.html` (script section)

Implement the shuffle button for randomizing first-round matchups.

- [ ] **Step 1: Implement shuffle logic**

Write `shuffleFirstRound(bracket)`:
- Collect all cellIds from first-round slots (both filled and null)
- Fisher-Yates shuffle the array
- Reassign cellIds back to first-round slots in order
- Update each Cell's `sourceSlot` to match its new position
- Update `bracket.updatedAt`

- [ ] **Step 2: Wire up toolbar button with guard and confirmation**

On shuffle button click:
- If `hasTournamentStarted(bracket)`: do nothing (button should already be disabled/hidden, but guard anyway)
- Show confirmation dialog: "Shuffle all first-round matchups? This can't be undone."
- If confirmed: call `shuffleFirstRound()`, re-render

- [ ] **Step 3: Update shuffle button state on render**

In `renderBracket` or a toolbar update function:
- If `hasTournamentStarted(bracket)`: add `.disabled` class to shuffle button
- Otherwise: remove `.disabled` class

- [ ] **Step 4: Verify in browser**

- Fill some first-round slots → click Shuffle → confirmation appears
- Confirm → cells are randomized in different positions
- Promote a winner → Shuffle button becomes disabled

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add shuffle with confirmation and tournament guard"
```

---

## Task 12: localStorage Persistence + Brackets List

**Files:**
- Modify: `index.html` (script section)

Implement auto-save, bracket list, and bracket switching.

- [ ] **Step 1: Implement auto-save**

Write `saveBracket(bracket)`:
- Serialize bracket to JSON (convert cells Map to a plain object for JSON compatibility)
- Save to localStorage under key `matchvine_bracket_{id}`
- Also maintain a bracket index in `matchvine_index`: array of `{ id, title, size, updatedAt }`
- Call this after every state change (edit, promote, demote, color change, etc.)

Write `loadBracket(id)`:
- Read from localStorage, deserialize, reconstruct the cells Map
- Return the bracket object

- [ ] **Step 2: Implement startup loading**

On page load:
- Read `matchvine_index` from localStorage
- If it has entries, load the most recently updated bracket
- If no entries, create a new default bracket (size 16, title "New Bracket")
- Render the loaded bracket

- [ ] **Step 3: Implement brackets list dialog**

Wire up the Brackets button → show `#brackets-dialog`:
- Read `matchvine_index`, sort by `updatedAt` descending
- Render each entry: title, slot count, relative time ("2 min ago", "yesterday")
- Current bracket highlighted with "Current" badge
- Click a bracket → call `loadBracket(id)`, set as `state.bracket`, re-render, close dialog

- [ ] **Step 4: Implement new bracket creation**

"+ New" button in brackets dialog:
- Creates a new bracket (size 16, title "New Bracket")
- Saves it
- Switches to it
- Closes dialog

- [ ] **Step 5: Implement bracket deletion**

Each bracket entry (except current) has a 🗑 delete button:
- Click → confirmation: "Delete 'Title'? This can't be undone."
- If confirmed: remove from localStorage and `matchvine_index`, re-render the list
- Cannot delete the currently active bracket (hide the button or show an error)

- [ ] **Step 6: Implement relative time formatting**

Write `formatRelativeTime(isoString)`: returns "just now", "2 min ago", "1 hour ago", "yesterday", "Mar 15", etc.

- [ ] **Step 7: Verify in browser**

- Make changes → refresh page → bracket is preserved
- Open brackets list → shows saved brackets
- Create a new bracket → switches to it, old one still in list
- Switch between brackets → data loads correctly
- Delete a bracket → removed from list

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: add localStorage persistence and brackets list"
```

---

## Task 13: File Export and Import (.bracket)

**Files:**
- Modify: `index.html` (script section)

Implement Save Bracket and Load Bracket for `.bracket` files.

- [ ] **Step 1: Implement file export**

On "Save Bracket" button click:
- Serialize the current bracket to JSON (same serialization as localStorage)
- Create a `Blob` with type `application/json`
- Create a download link with `URL.createObjectURL(blob)`
- Set filename to `{bracket.title}.bracket` (sanitize title for filename: replace non-alphanumeric with dashes)
- Trigger the download
- Clean up the object URL

- [ ] **Step 2: Implement file import**

On "Load Bracket" button click:
- Trigger the hidden `<input type="file" accept=".bracket">` element
- On file selected: read with `FileReader.readAsText()`
- Parse JSON, validate it has required fields (id, title, size, slots, cells)
- If valid: save to localStorage (may overwrite if same id, or assign new id), set as current bracket, re-render
- If invalid: show an alert with error message

- [ ] **Step 3: Verify in browser**

- Save bracket → `.bracket` file downloads
- Load bracket → file picker opens, selecting a valid file loads it
- Load bracket with invalid file → error message shown

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add .bracket file export and import"
```

---

## Task 14: PNG Export

**Files:**
- Modify: `index.html` (script section)

Implement full bracket rendering to Canvas for PNG download.

- [ ] **Step 1: Implement canvas rendering function**

Write `renderBracketToCanvas(bracket)`:
- Create an offscreen `<canvas>` element
- Size it to fit the full bracket (use `calculateLayout` to get dimensions, add padding)
- Fill background with `bracket.backgroundColor`
- Draw the bracket title centered at top, in the bracket's font
- For each slot, draw the cell as a rounded rectangle with fill color, border, and text
- Use the same auto-sizing logic for text
- Champion slot gets the gold border and trophy
- Draw connector lines between cells (same geometry as SVG rendering)
- If `showSeedNumbers`, draw seed numbers
- Draw round labels at the bottom
- Return the canvas

- [ ] **Step 2: Implement font loading for canvas**

Before rendering to canvas, ensure the bracket's Google Font is loaded (canvas `fillText` needs the font available). Use `document.fonts.load()` to preload the font at the needed sizes.

- [ ] **Step 3: Implement PNG download**

On "Export PNG" button click:
- Call `renderBracketToCanvas(bracket)`
- Call `canvas.toBlob()` to get a PNG blob
- Create a download link, set filename to `{bracket.title}.png`
- Trigger download, clean up

- [ ] **Step 4: Verify in browser**

- Fill a bracket with some data and colors
- Click Export PNG → PNG file downloads
- Open the PNG → bracket looks correct with all styling, title, colors, lines

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add PNG export via Canvas API"
```

---

## Task 15: Region Focus Navigation

**Files:**
- Modify: `index.html` (script section + CSS)

Implement structured zoom — click to focus on a bracket region.

- [ ] **Step 1: Define bracket regions**

Write `getBracketRegions(size)`:
- For sizes 4, 8, 16: return `null` (no regions needed, everything fits)
- For size 32: return 4 regions (top-left, bottom-left, top-right, bottom-right quarters)
- For size 64: return 4 quarters
- For size 128: return 8 eighths
- Each region is: `{ name, startSlotIndex, endSlotIndex, rounds }` — enough info to identify which slots belong to it

- [ ] **Step 2: Render region click targets in full view**

When the bracket is in full view and regions are available:
- Overlay semi-transparent clickable region rectangles over each quarter/eighth of the bracket
- On hover, region highlights slightly
- On click, trigger focus on that region

- [ ] **Step 3: Implement focus mode rendering**

Write `renderFocusedRegion(bracket, region)`:
- Only render the slots that belong to the selected region
- Scale them up to fill the bracket container at full, legible size
- Add a "← Back to full bracket" button or breadcrumb at the top of the bracket area
- Store `bracket.zoomState = { focused: true, region }` and save

- [ ] **Step 4: Implement return to full view**

On "Back" button click:
- Set `bracket.zoomState = { focused: false, region: null }`
- Call `renderBracket()` normally
- Save state

- [ ] **Step 5: Implement scale-to-fit for full view**

Write `scaleToFit()`:
- After rendering the full bracket, calculate the scale factor to fit the container
- Apply a CSS `transform: scale(factor)` with `transform-origin: center center` on the bracket content
- This ensures the full bracket is always visible regardless of window size

- [ ] **Step 6: Verify in browser**

- Create a 64-slot bracket → full view shows all cells (scaled to fit)
- Region highlights appear on hover
- Click a region → zooms into that quarter with full-size cells
- Click "Back" → returns to full view
- Small brackets (4, 8, 16) → no region navigation shown

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add region focus navigation for large brackets"
```

---

## Task 16: Polish and Final Integration

**Files:**
- Modify: `index.html`

Final pass: wire up auto-save everywhere, ensure all interactions work together, visual polish.

- [ ] **Step 1: Wire auto-save into all state changes**

Ensure `saveBracket()` is called after:
- Cell text edit confirmed
- Color change (bg or text)
- Promote / demote
- Drag and drop
- Shuffle
- Seed import
- Settings changes (size, font, background, seed numbers)
- Title edit
- Region focus change

- [ ] **Step 2: Ensure shuffle button state updates correctly**

After any render, update the shuffle button's disabled state based on `hasTournamentStarted()`.

- [ ] **Step 3: Ensure drag-and-drop disables correctly**

After any promote, verify that first-round cells lose `draggable` attribute on next render.

- [ ] **Step 4: Handle window resize**

Add a `resize` event listener that re-calls `scaleToFit()` (or re-renders the focused region) so the bracket stays properly sized.

- [ ] **Step 5: Add CSS transitions and micro-interactions**

- Smooth transition on cell border/shadow changes (hover, edit, winner states)
- Fade transition on promote buttons appearing/disappearing
- Smooth opacity transition for loser cells
- Dialog fade-in on open

- [ ] **Step 6: Test full workflow end-to-end**

In the browser, run through the complete user journey:
1. Open page → empty 16-slot bracket
2. Open seed dialog → paste 16 names → Import
3. Cells filled with random colors
4. Click some cells, edit text
5. Change a cell's background color via 🎨 popover
6. Promote winners through several rounds
7. Verify track: edit a promoted cell's text → updates everywhere
8. Demote a winner → slot cleared, matchup reopened
9. Change font in settings
10. Export PNG → verify image
11. Save bracket → `.bracket` file downloads
12. Create new bracket → load the saved file → original bracket restored
13. Check brackets list → both brackets appear
14. Resize window → bracket rescales

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: polish integration, auto-save, and transitions"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | HTML skeleton + CSS foundation | None |
| 2 | Constants + data model + state management | None |
| 3 | Bracket rendering (convergent layout) | 1, 2 |
| 4 | Cell text editing | 3 |
| 5 | Color formatting popover | 4 |
| 6 | Promote and demote | 4 |
| 7 | Drag and drop | 6 (needs hasTournamentStarted) |
| 8 | Toolbar title + settings dialog | 3 |
| 9 | Google Fonts integration | 8 |
| 10 | Seed dialog | 4 |
| 11 | Shuffle | 6 (needs hasTournamentStarted) |
| 12 | localStorage persistence + brackets list | 3 |
| 13 | File export / import | 12 |
| 14 | PNG export | 3, 5 |
| 15 | Region focus navigation | 3 |
| 16 | Polish and final integration | All above |
