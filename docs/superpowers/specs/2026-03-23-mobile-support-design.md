# Mobile Support Design

## Overview

Add a mobile-optimized view for Matchvine that provides the full bracket editing experience adapted for touch devices. Phones and tablets get a card-based matchup view instead of the full bracket layout.

## Detection

Use `(pointer: coarse)` CSS media query and `window.matchMedia('(pointer: coarse)')` in JS. This detects touch-primary devices (phones, tablets) while keeping desktops on the existing view — even touchscreen laptops with a mouse/trackpad stay on desktop view.

## Mobile Layout

### One Matchup at a Time

Instead of rendering the full bracket, mobile shows a single matchup as a full-width card:

- Two cells stacked vertically, each taking the full screen width
- Each cell shows the competitor name, background color, and text
- A "Winner" button below each cell for promoting
- Large, tappable touch targets throughout

### Navigation

**Round tabs** across the top of the screen:
- Horizontal strip: Round 1, Quarterfinals, Semifinals, Finals, 🏆
- Current round highlighted
- Tap to jump to any round

**Up/down arrows** to navigate between matchups within the current round:
- Arrows on screen (top/bottom or left/right of the matchup card)
- Step through matchups one at a time
- Indicator showing "Matchup 3 of 8" or similar

**Bracket title** displayed prominently above the round tabs.

## Interactions

### Promoting

Dedicated "Winner" button below each cell in the matchup card. Tap the button to promote that competitor to the next round. No ambiguity between editing and promoting.

### Text Editing

Tapping a cell opens a **bottom sheet** with:
- A real `<input>` or `<textarea>` element (not contenteditable)
- The cell's current text pre-filled
- Save and Cancel buttons
- Native mobile keyboard works reliably

### Color Picker

Tapping the palette icon opens a **bottom sheet** sliding up from the bottom:
- Full color palette grid with large tappable swatches (same colors as desktop)
- Dismiss by swiping down or tapping outside
- Color changes apply immediately (preview in real-time)

### Seeding

The seed dialog adapts to full-screen on mobile. Textarea takes full width, Import button is large and tappable.

## Settings

Same settings as desktop, displayed in a full-screen panel instead of a centered dialog:
- Bracket size, font, background color, layout mode, auto-color toggle, seed numbers toggle
- All controls sized for touch

## Shared Data

The data model is identical between mobile and desktop:
- Same bracket object structure
- Same localStorage persistence
- Same .bracket file format for export/import
- Opening the same bracket on desktop and mobile shows the same data, just different presentation

## What Changes vs What Stays

**New (mobile only):**
- `js/mobile.js` — mobile view rendering, navigation, touch interactions
- CSS media queries in `index.html` for `(pointer: coarse)` responsive styles
- Bottom sheet component for text editing and color picker
- Matchup card component
- Round tab navigation

**Modified:**
- `js/main.js` — detect mobile at startup, initialize mobile or desktop view
- `index.html` — add mobile-specific HTML (bottom sheets, nav bar) and CSS

**Unchanged:**
- `js/state.js` — data model
- `js/constants.js` — colors, fonts, sizes
- `js/utils.js` — utilities
- `js/storage.js` — persistence
- `js/layout.js` — desktop layout (mobile doesn't use it)
- `js/editing.js` — desktop editing (mobile has its own)
- `js/dialogs.js` — desktop dialogs (mobile has its own panels)
- `js/render.js` — desktop rendering (mobile has its own)
- `js/png-export.js` — export (works from data, not from view)

## Testing

### Unit Tests
- Navigation logic: round switching, matchup stepping, bounds checking

### E2E Tests (Playwright with mobile emulation)
- Create bracket on mobile
- Navigate between rounds and matchups
- Edit cell text via bottom sheet
- Promote winner via button
- Change color via bottom sheet
- Seed import on mobile
- Verify data persists across reload
