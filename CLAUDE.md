# Matchvine

Tournament bracket maker — single-page web app hosted on GitHub Pages.

## Tech Stack

- Vanilla HTML/CSS/JS with ES modules (`<script type="module">`)
- No framework — plain DOM manipulation
- Google Fonts loaded on demand (only external dependency at runtime)
- Vitest for unit tests
- Playwright for end-to-end tests

## Project Structure

```
index.html          — HTML shell + CSS + module entry point
js/
  main.js           — Initialization, event wiring
  constants.js      — Palette, fonts, sizes, layout constants
  state.js          — Data model, state management, slot indexing math
  render.js         — Single clean renderBracket() function
  layout.js         — Layout calculation (full + staggered modes)
  editing.js        — Cell text editing (contenteditable)
  dialogs.js        — Settings, seed, brackets list, new bracket, format popover
  storage.js        — localStorage, .bracket file export/import
  png-export.js     — Canvas rendering for PNG download
  utils.js          — escapeHtml, contrast calc, relative time formatting
tests/
  unit/             — Vitest unit tests
  e2e/              — Playwright end-to-end tests
```

## Code Conventions

- **CSS for styling, not JS**: Use CSS classes for all visual states. JS toggles classes, never sets `element.style.*` — except for computed positions (`left`, `top`) on absolutely-placed bracket cells.
- **No monkey-patching**: `renderBracket()` is one function with explicit steps. No wrapping/overriding.
- **Editing modifies DOM directly**: `enterEditMode()` does NOT call `renderBracket()`. It modifies the existing cell element in-place for immediate focus.
- **TDD for pure functions**: Slot math, contrast calc, layout positions — write tests first.

## Running

- `npx vitest` — run unit tests
- `npx playwright test` — run e2e tests
- Open `index.html` in a browser — that's it, no build step

## GitHub Pages

Deployed from the root of the repo. `index.html` + `js/` folder is all that's needed.
