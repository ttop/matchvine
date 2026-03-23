# Matchvine

Tournament bracket maker — a single-page web app with no build step, no framework, and zero runtime dependencies (aside from optional Google Fonts).

**Live site:** [ttop.github.io/matchvine](https://ttop.github.io/matchvine)

## Features

- Create single-elimination brackets (4 to 64 slots)
- Seed participants manually or paste a list
- Shuffle seeding randomly
- Click to advance winners through rounds
- Drag-and-drop to reorder participants
- Customizable colors, fonts, and cell sizes
- Export brackets as PNG images
- Save/load brackets as `.bracket` files
- All brackets persist in localStorage automatically

## Getting Started

The app uses ES modules, so it needs a local web server to run (opening `index.html` directly via `file://` won't work due to CORS restrictions).

```sh
# Serve locally with any static server, e.g.:
npx serve
```

### Development Setup

```sh
npm install
```

### Run Tests

```sh
npm test              # unit tests (Vitest)
npm run test:e2e      # end-to-end tests (Playwright)
npm run test:all      # both
```

## Project Structure

```
index.html            Main app (HTML + CSS + module entry point)
js/
  main.js             Initialization and event wiring
  constants.js        Palette, fonts, sizes, layout constants
  state.js            Data model, state management, slot indexing math
  render.js           Bracket rendering
  layout.js           Layout calculation (full + staggered modes)
  editing.js          Cell text editing (contenteditable)
  dialogs.js          Settings, seed, brackets list, new bracket, format popover
  storage.js          localStorage and .bracket file export/import
  png-export.js       Canvas rendering for PNG download
  utils.js            Shared helpers
tests/
  unit/               Vitest unit tests
  e2e/                Playwright end-to-end tests
```

## License

[MIT](LICENSE)
