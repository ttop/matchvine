# Matchvine — Tournament Bracket Maker

## Overview

Matchvine is a standalone, single-page HTML app for creating and managing tournament brackets. Users can create brackets of various sizes, fill in competitors, customize colors and fonts, promote winners through rounds, and export the result as a PNG image. The app is content-agnostic — it works for songs, sports teams, food rankings, or anything else.

**Target audience**: Teenagers and casual users who want to make brackets in person with friends. Also open source for anyone to use.

**Hosting**: GitHub Pages as a single `index.html` file.

## Architecture

- **Single HTML file** with embedded CSS and JavaScript
- **No build step**, no framework, no npm
- **One external dependency**: Google Fonts (loaded on demand)
- **Persistence**: localStorage for auto-saving brackets
- **Export**: `.bracket` files (JSON internally) and PNG images

## Data Model

### Bracket

```
id              string    Unique ID (timestamp-based)
title           string    Bracket title (editable)
titleFont       string    Google Font name for title and all cells
size            number    First-round slot count (4, 8, 16, 32, 64, 128)
backgroundColor string    Bracket background color
showSeedNumbers boolean   Whether to display seed numbers on first-round slots
createdAt       string    ISO timestamp
updatedAt       string    ISO timestamp
slots           Slot[]    Flat array of all slots (2N - 1 total)
cells           Map<id,Cell>  All cells in the bracket, keyed by cell ID
zoomState       object    Which region is focused (or full view), persisted per bracket
```

### Slot

A slot is a position in the bracket grid, identified by `round` and `index`.

```
round           number    0 = first round, 1 = second, etc.
index           number    Position within the round (top to bottom)
cellId          string|null  ID of the Cell occupying this slot, or null if empty
```

### Cell

A Cell represents a competitor's data. A single Cell can occupy multiple slots when promoted through rounds (the "track"). Editing a Cell anywhere in its track updates all instances.

```
id              string    Unique ID
text            string    Competitor name/text (supports line breaks)
textColor       string    Text color (hex)
bgColor         string    Background color (hex, from curated palette)
sourceSlot      object    {round, index} of the Cell's original first-round position
```

### Track Concept

- A Cell starts in a first-round slot
- When promoted, the same Cell ID is assigned to the next-round slot
- The Cell's data (text, colors) is shared across all slots it occupies
- Editing text or colors on any slot in the track updates all of them
- Demoting removes the Cell from its highest-round slot only

### Indexing

Slots are stored in a flat array. For a bracket of size N:
- Round 0: slots[0] through slots[N-1]
- Round 1: slots[N] through slots[N + N/2 - 1]
- ...and so on
- Total slots: 2N - 1

The bracket is split into two halves (left and right) that converge at the center champion slot.

## Layout

### March Madness Convergent Style

- **Left half**: First-round slots on the far left, advancing rightward toward center
- **Right half**: First-round slots on the far right, advancing leftward toward center
- **Champion slot**: Centered where the two halves meet
- Each half gets exactly half the first-round slots

### Cells

- Rounded rectangles (8px border radius)
- Fixed width per round, **fixed height** (cells never grow or shrink)
- Text starts large and **auto-shrinks** to fit within the fixed cell dimensions
- Text wraps within the cell; Shift+Enter inserts a manual line break
- Empty/undecided slots: light gray background with "?"

### Connector Lines

- Thin gray lines (1.5px)
- Classic bracket tree shape: horizontal from each cell in a pair → vertical join → horizontal to next-round slot
- Lines connect at the vertical midpoint of each cell

### Champion Slot

- Centered between the two halves
- Gold/amber border (always present)
- When a winner is decided, inherits the winner's background color, text color, and font styling
- Trophy icon (🏆) displayed
- Slightly wider than regular cells

### Seed Numbers

- Small gray numbers (#1, #2, etc.) displayed beside first-round cells
- Toggleable on/off via Settings
- When importing a text list, the list order determines seed order (#1 = first name, #2 = second, etc.)
- Traditional seeding pattern (1v16, 8v9, etc.)

### Round Labels

- Displayed at the bottom of each round column
- Named: "Round 1", "Round 2", ..., "Semis", "Final"

## Cell Interaction

### Cell States

1. **Empty**: Light gray, displays "?"
2. **Filled (idle)**: Shows text with background color, no special border
3. **Hover**: Blue outline, formatting icon (🎨) appears in top-right corner
4. **Editing**: Blue glow + blinking cursor, 🎨 icon stays visible

### Text Editing

- **Click cell body** → enter edit mode (blinking cursor)
- **Type** → edit text
- **Enter** → confirm edit, exit edit mode
- **Shift+Enter** → insert line break within cell
- **Escape** → cancel edit, revert text
- **Click outside** → confirm edit, exit edit mode

### Promote / Demote

**Promote:**
- When both cells in a matchup are filled and no winner decided, a promote button appears
- Left-side cells: `›` button on right edge (pointing toward center)
- Right-side cells: `‹` button on left edge (pointing toward center)
- Clicking promotes the Cell into the next-round slot (same Cell ID, shared data)
- Winner gets green border + checkmark; loser fades to 50% opacity

**Demote:**
- A red `×` badge appears on hover on any promoted cell (rounds after the first)
- Clicking removes the Cell from that slot only (moves back one round)
- Earlier slots in the track are unaffected

### Drag and Drop (Pre-Tournament Only)

- Only available for first-round cells before any promotions have happened
- **Drag to empty cell** → move contents
- **Drag to occupied cell** → swap both cells' contents
- Visual feedback: ghost cell follows cursor, drop target highlights

## Cell Formatting

### Popover (Per-Cell Colors)

- **🎨 icon** appears in the top-right corner of a cell on hover and while editing
- Clicking the icon opens a formatting popover above the cell
- Popover contains:
  - **Background color**: Full curated palette (~40 colors) displayed as a grid — pastels, medium, vivid, light tints, and neutrals. No extra click needed to see all colors.
  - **Text color**: Row of common options (black, dark gray, gray, white, navy, dark red, dark green)
  - **Auto contrast checkbox**: On by default. When checked, text color auto-adjusts based on background brightness using WCAG contrast ratio calculation. User can uncheck to pick manually.
- Popover dismisses on click outside or Escape
- Changes apply to the entire track (all slots showing this Cell)

### Color Palette

~40 curated colors organized in an 8-column grid:
- Row 1: Pastels (light red, orange, yellow, green, cyan, blue, purple, pink)
- Row 2: Medium tones
- Row 3: Vivid/saturated
- Row 4: Very light tints
- Row 5: Neutrals (white, light gray, medium gray, dark gray, tans, earth tones)

No super-dark backgrounds. All colors chosen to work well with either dark or light text.

### Auto-Assign on Creation

When a bracket is created, first-round cells are auto-assigned random colors from the palette so the bracket is visually colorful from the start. Colors carry forward through promotions, creating a visual narrative of whose color made it to the finals.

## Bracket-Level Settings

Accessed via ⚙️ Settings button in the toolbar. Dialog contains:

- **Bracket Size**: Toggle buttons for 4, 8, 16, 32, 64, 128
- **Font**: Curated grid of ~15-20 Google Fonts with preview text. Loaded on demand. "More fonts..." expands the selection. Font applies to the entire bracket (title + all cells).
- **Bracket Background**: Small palette of whites, light grays, and soft tinted options (no dark backgrounds)
- **Show Seed Numbers**: Toggle switch

**Changing bracket size**: Changing the size creates a new empty bracket (same title and settings). If the current bracket has data, a confirmation dialog warns that existing data will be lost. This is a destructive operation — use "Save Bracket" first if needed.

## Toolbar

Always visible at the top of the page. Contains:

| Element | Behavior |
|---------|----------|
| 🌿 Matchvine | App name/logo |
| Bracket title | Click to edit inline |
| 📋 Seed | Opens seed dialog |
| 🔀 Shuffle | Randomizes first-round positions. Disabled once any promotion happens. Shows confirmation dialog. |
| ⚙️ Settings | Opens bracket settings dialog |
| 📷 Export PNG | Downloads full bracket as PNG |
| 💾 Save Bracket | Downloads as `.bracket` file |
| 📂 Load Bracket | File picker for `.bracket` files |
| 📁 Brackets | Opens saved brackets list |

## Seed Dialog

- Modal with a large text area
- Paste or type names, one per line
- Blank lines ignored
- Names fill into the **next available empty** first-round slots (top to bottom, left to right)
- Supports incremental seeding — add 20 names now, 20 more later
- If more names than empty slots, warn and truncate
- Preview count shown: "23 names → 23 of 32 slots will be filled"
- Import order = seed order (#1 = first name, etc.)
- "Import" button to confirm

## Shuffle

- Toolbar button, independent from Seed
- Randomizes positions of all filled first-round cells
- **Only enabled pre-tournament** (before any cell has been promoted)
- Grays out / disables once any promotion happens
- Confirmation dialog: "Shuffle all first-round matchups? This can't be undone."

## Navigation (Zoom & Focus)

No arbitrary zoom/pan. Navigation is structured:

- **Default view**: Entire bracket scaled to fit the screen
- **Focus mode**: Click a region of the bracket to zoom into it — a cluster of matchups that feed into each other (e.g., a quarter of the bracket)
- **Return**: Click to go back to the full view
- **Regions** are natural bracket divisions:
  - Quarters (top-left, bottom-left, top-right, bottom-right)
  - Eighths for 128-slot brackets
- When focused, the selected region fills the screen with full-size readable cells
- **Auto-hides navigation** for small brackets (4, 8, 16) where everything fits legibly

## Bracket Management

### Auto-Save

- Brackets auto-save to localStorage on every change
- `updatedAt` timestamp tracks last edit

### Brackets List (via 📁 button)

- Shows all saved brackets from localStorage
- Each entry displays: title, slot count, last edited time
- Current bracket highlighted
- Click a bracket to load it
- Delete button (🗑) per bracket with confirmation
- "+ New" button to create a fresh bracket

### File Export / Import

- **Save Bracket**: Downloads the bracket as a `.bracket` file (JSON internally, but the extension and UI never mention JSON)
- **Load Bracket**: File picker to upload a `.bracket` file, loads it into the app and saves to localStorage

## PNG Export

- Renders the full bracket (all regions, not just current focused view) to a canvas
- Includes the title at the top
- Captures all cell colors, fonts, connecting lines, champion styling
- Downloads as `{bracket-title}.png`
- Hand-rolled using the Canvas API (no external library) to maintain the zero-dependency constraint

## Technical Notes

### Font Loading

- Google Fonts loaded on demand via `<link>` tags
- Font preview in settings dialog lazy-loads fonts as they scroll into view
- System font fallbacks (sans-serif, serif) available for offline use

### Text Auto-Sizing

- Cell dimensions are fixed and never change
- Text starts at the largest configured font size
- If text overflows, font size progressively shrinks until it fits
- Minimum font size floor to maintain legibility

### Contrast Calculation

- Uses relative luminance formula per WCAG 2.1
- When auto-contrast is on: dark text for light backgrounds, white text for dark backgrounds
- Threshold based on contrast ratio ≥ 4.5:1
