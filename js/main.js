// ── Matchvine — Main Entry Point ─────────────────────────────────────────

import { state } from './state.js';
import { renderBracket, setOnSave, setOnTitleChange } from './render.js';
import { setupEditingEvents } from './editing.js';
import {
  setupDialogEvents, openNewBracketDialog,
  applyBracketStyles, applyFont, loadGoogleFont, isGoogleFont,
} from './dialogs.js';
import {
  saveBracket, loadBracketIndex, loadBracket,
  deleteBracketFromStorage, downloadBracketFile,
  handleBracketFileLoad, fullRenderCurrentBracket,
} from './storage.js';
import { exportPNG } from './png-export.js';
import { buildSlugMap } from './utils.js';

// ── Wire save into render ────────────────────────────────────────────────

setOnSave(saveBracket);
setOnTitleChange(updateHash);

// ── Render deps for fullRenderCurrentBracket ─────────────────────────────

const renderDeps = {
  renderBracket,
  applyBracketStyles,
  applyFont,
  loadGoogleFont,
  isGoogleFont,
};

function doFullRender() {
  fullRenderCurrentBracket(renderDeps);
}

// ── URL hash ────────────────────────────────────────────────────────────

function updateHash() {
  const index = loadBracketIndex();
  const { idToSlug } = buildSlugMap(index);
  const slug = state.bracket ? idToSlug.get(state.bracket.id) : null;
  if (slug) {
    history.replaceState(null, '', '#' + slug);
  } else {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

// ── Initialize ───────────────────────────────────────────────────────────

const container = document.getElementById('bracket-container');

// Wire up editing events (click-to-edit, click-outside-to-confirm)
setupEditingEvents(container);

// Wire up dialog events (settings, seed, brackets, new bracket, format popover, etc.)
setupDialogEvents({
  saveBracket,
  loadBracketIndex,
  loadBracket,
  deleteBracketFromStorage,
  fullRenderCurrentBracket: doFullRender,
  updateHash,
});

// ── Toolbar: Export PNG ──────────────────────────────────────────────────

document.getElementById('btn-export-png').addEventListener('click', function() {
  if (!state.bracket) return;
  exportPNG(state.bracket, { loadGoogleFont, isGoogleFont });
});

// ── Toolbar: Save to file ────────────────────────────────────────────────

document.getElementById('btn-save').addEventListener('click', function() {
  downloadBracketFile(state.bracket);
});

// ── Toolbar: Load from file ──────────────────────────────────────────────

document.getElementById('btn-load').addEventListener('click', function() {
  document.getElementById('load-file-input').click();
});

document.getElementById('load-file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  handleBracketFileLoad(file, function(data) {
    state.bracket = data;
    saveBracket(data);
    doFullRender();
    updateHash();
  });

  // Reset so the same file can be loaded again
  this.value = '';
});

// ── Load most recent bracket or show new-bracket dialog ──────────────────

(function initApp() {
  const index = loadBracketIndex();

  if (index.length > 0) {
    // Check URL hash for a specific bracket
    const hash = location.hash.replace(/^#/, '');
    let bracket = null;

    if (hash) {
      const { slugToId } = buildSlugMap(index);
      const id = slugToId.get(hash);
      if (id) bracket = loadBracket(id);
    }

    // Fall back to most recently updated
    if (!bracket) {
      index.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      bracket = loadBracket(index[0].id);
    }

    if (bracket) {
      state.bracket = bracket;
      doFullRender();
      updateHash();
      return;
    }
  }

  // No saved brackets — show creation dialog
  openNewBracketDialog();
})();
