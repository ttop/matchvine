import {
  BRACKET_SIZES, COLOR_PALETTE, DEFAULT_FONTS, GOOGLE_FONTS,
} from './constants.js';
import {
  state, createBracket, createCell,
  getSlotsInRound, getSlotIndex, getTotalRounds,
  getNextSlot, hasTournamentStarted,
} from './state.js';
import { escapeHtml, getAutoTextColor, formatRelativeTime, getRandomColor } from './utils.js';
import { renderBracket } from './render.js';

// Forward-declared references to storage functions.
// These are set by setupDialogEvents to avoid circular imports.
let _saveBracket = null;
let _loadBracketIndex = null;
let _loadBracket = null;
let _deleteBracketFromStorage = null;
let _fullRenderCurrentBracket = null;

// ── Background colors for settings ──────────────────────────────────────

const BACKGROUND_COLORS = [
  '#ffffff',  // White
  '#f8fafc',  // Cool white
  '#faf8f5',  // Warm white
  '#e2e8f0',  // Slate
  '#d1d5db',  // Gray
  '#dbeafe',  // Light blue
  '#d1fae5',  // Mint
  '#fef3c7',  // Light amber
  '#fce7f3',  // Light pink
  '#e9d5ff',  // Light purple
  '#fecaca',  // Light red
  '#fed7aa',  // Peach
];

// ── Google Fonts ─────────────────────────────────────────────────────────

const loadedGoogleFonts = new Set();

export function loadGoogleFont(fontName) {
  if (loadedGoogleFonts.has(fontName)) {
    return document.fonts.load(`500 16px "${fontName}"`).then(() => {}).catch(() => {});
  }

  const encoded = fontName.replace(/\s+/g, '+');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
  loadedGoogleFonts.add(fontName);

  return document.fonts.load(`500 16px "${fontName}"`).then(() => {}).catch(() => {
    return document.fonts.ready;
  });
}

export function isGoogleFont(fontFamily) {
  return GOOGLE_FONTS.includes(fontFamily);
}

function isSystemFont(fontFamily) {
  return DEFAULT_FONTS.some(f => f.family === fontFamily);
}

export function applyFont(bracket) {
  const font = bracket.titleFont || 'sans-serif';
  const container = document.getElementById('bracket-container');
  if (isSystemFont(font)) {
    container.style.fontFamily = `${font}`;
  } else {
    container.style.fontFamily = `"${font}", sans-serif`;
  }
}

export function applyBracketStyles(bracket) {
  const container = document.getElementById('bracket-container');
  container.style.backgroundColor = bracket.backgroundColor || '#ffffff';
}

// ── Dialog helpers ───────────────────────────────────────────────────────

export function showDialog(dialogId) {
  document.getElementById(dialogId).classList.remove('hidden');
  document.getElementById('dialog-overlay').classList.remove('hidden');
}

export function hideDialog(dialogId) {
  document.getElementById(dialogId).classList.add('hidden');
  document.getElementById('dialog-overlay').classList.add('hidden');
}

export function hideAllDialogs() {
  ['settings-dialog', 'seed-dialog', 'brackets-dialog', 'new-bracket-dialog'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('dialog-overlay').classList.add('hidden');
}

// ── Format Popover ───────────────────────────────────────────────────────

export function showFormatPopover(slotIndex) {
  const bracket = state.bracket;
  const slot = bracket.slots[slotIndex];
  if (!slot || !slot.cellId) return;
  const cell = bracket.cells[slot.cellId];
  if (!cell) return;

  state.formattingSlotIndex = slotIndex;

  const popover = document.getElementById('format-popover');
  const bgGrid = document.getElementById('bg-color-grid');

  // Populate background color grid
  bgGrid.innerHTML = '';
  COLOR_PALETTE.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;
    swatch.setAttribute('data-color', color);
    swatch.setAttribute('data-type', 'bg');
    if (cell.bgColor === color) swatch.classList.add('selected');
    bgGrid.appendChild(swatch);
  });

  // Position popover relative to the cell
  const container = document.getElementById('bracket-container');
  const cellEl = container.querySelector(`.cell[data-slot-index="${slotIndex}"]`);
  if (!cellEl) return;

  const cellRect = cellEl.getBoundingClientRect();
  const popoverWidth = 240;
  let left = cellRect.left + (cellRect.width / 2) - (popoverWidth / 2);

  popover.classList.remove('hidden');
  popover.classList.remove('popover-below');

  const popoverHeight = popover.offsetHeight;
  const GAP = 8;

  let showBelow = false;
  let top;

  if (cellRect.top - popoverHeight - GAP < 4) {
    showBelow = true;
    top = cellRect.bottom + GAP;
    popover.classList.add('popover-below');
  } else {
    top = cellRect.top - popoverHeight - GAP;
  }

  if (left < 4) left = 4;
  if (left + popoverWidth > window.innerWidth - 4) left = window.innerWidth - popoverWidth - 4;

  popover.style.left = left + 'px';
  popover.style.top = top + 'px';
}

export function hideFormatPopover() {
  state.formattingSlotIndex = null;
  document.getElementById('format-popover').classList.add('hidden');
}

// ── Settings Dialog ──────────────────────────────────────────────────────

export function openSettingsDialog() {
  const bracket = state.bracket;

  // Highlight current size
  document.querySelectorAll('#size-toggles .size-toggle').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.getAttribute('data-size'), 10) === bracket.size);
  });

  // Populate background color grid
  const bgGrid = document.getElementById('settings-bg-color-grid');
  bgGrid.innerHTML = '';
  BACKGROUND_COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;
    swatch.setAttribute('data-color', color);
    if (bracket.backgroundColor === color) swatch.classList.add('selected');
    bgGrid.appendChild(swatch);
  });

  // Seed numbers toggle
  document.getElementById('toggle-seed-numbers').checked = bracket.showSeedNumbers;
  document.getElementById('toggle-auto-color').checked = bracket.autoColor !== false;

  // Layout toggles
  const layoutToggles = document.getElementById('layout-toggles');
  if (layoutToggles) {
    layoutToggles.querySelectorAll('.size-toggle').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-layout') === (bracket.layoutMode || 'full'));
    });
  }

  // Font picker
  populateFontPicker();

  showDialog('settings-dialog');
}

function populateFontPicker() {
  const grid = document.getElementById('font-picker-grid');
  grid.innerHTML = '';

  const currentFont = state.bracket.titleFont || 'sans-serif';

  // System fonts
  DEFAULT_FONTS.forEach(font => {
    const card = document.createElement('div');
    card.className = 'font-option';
    card.setAttribute('data-font-family', font.family);
    card.setAttribute('data-font-type', 'system');
    card.style.fontFamily = font.family;
    if (currentFont === font.family) card.classList.add('selected');

    card.innerHTML = `<div style="font-size:20px;font-weight:500">${escapeHtml(font.name)}</div>`;
    grid.appendChild(card);
  });

  // Google fonts
  GOOGLE_FONTS.forEach(fontName => {
    const card = document.createElement('div');
    card.className = 'font-option';
    card.setAttribute('data-font-family', fontName);
    card.setAttribute('data-font-type', 'google');
    if (currentFont === fontName) card.classList.add('selected');

    card.innerHTML = `<div class="font-preview" style="font-size:20px;font-weight:500">${escapeHtml(fontName)}</div>`;
    grid.appendChild(card);
  });

  // Lazy-load Google Font previews with IntersectionObserver
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        const fontName = card.getAttribute('data-font-family');
        const fontType = card.getAttribute('data-font-type');
        if (fontType === 'google') {
          loadGoogleFont(fontName).then(() => {
            card.style.fontFamily = `"${fontName}", sans-serif`;
          });
        }
        observer.unobserve(card);
      }
    });
  }, { root: grid.closest('.dialog-body'), threshold: 0.1 });

  grid.querySelectorAll('.font-option[data-font-type="google"]').forEach(card => {
    observer.observe(card);
  });
}

// ── Seed Dialog ──────────────────────────────────────────────────────────

function getEmptyFirstRoundSlots(bracket) {
  const empty = [];
  for (let i = 0; i < bracket.size; i++) {
    const slotIndex = getSlotIndex(bracket.size, 0, i);
    const slot = bracket.slots[slotIndex];
    if (!slot.cellId) {
      empty.push(slotIndex);
    }
  }
  return empty;
}

function updateSeedPreview() {
  const textarea = document.getElementById('seed-textarea');
  const preview = document.getElementById('seed-preview-count');
  const text = textarea.value;
  const names = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  const emptySlots = getEmptyFirstRoundSlots(state.bracket);
  const totalSlots = state.bracket.size;
  const emptyCount = emptySlots.length;

  if (names.length === 0) {
    preview.textContent = '0 participants entered';
    preview.style.color = '#6b7280';
  } else {
    const willFill = Math.min(names.length, emptyCount);
    let msg = `${names.length} names \u2192 ${willFill} of ${totalSlots} slots will be filled`;
    if (names.length > emptyCount) {
      msg += ` (${names.length - emptyCount} will be truncated \u2014 only ${emptyCount} empty slots)`;
      preview.style.color = '#dc2626';
    } else {
      preview.style.color = '#6b7280';
    }
    preview.textContent = msg;
  }
}

export function openSeedDialog() {
  const textarea = document.getElementById('seed-textarea');
  textarea.value = '';
  updateSeedPreview();
  showDialog('seed-dialog');
  textarea.focus();
}

// ── Brackets Dialog ──────────────────────────────────────────────────────

export function openBracketsDialog() {
  const entries = document.getElementById('bracket-entries');
  entries.innerHTML = '';

  const index = _loadBracketIndex();
  index.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  if (index.length === 0) {
    entries.innerHTML = '<p style="font-size:13px;color:#9ca3af;text-align:center;padding:16px 0">No saved brackets yet.</p>';
  } else {
    index.forEach(meta => {
      const entry = document.createElement('div');
      entry.className = 'bracket-entry';
      if (state.bracket && meta.id === state.bracket.id) {
        entry.style.borderColor = '#3b82f6';
        entry.style.background = '#eff6ff';
      }
      entry.setAttribute('tabindex', '0');

      const left = document.createElement('div');
      left.innerHTML = `<div class="bracket-entry-name">${escapeHtml(meta.title)}</div><div class="bracket-entry-meta">${meta.size} players \u00B7 ${formatRelativeTime(meta.updatedAt)}</div>`;

      const delBtn = document.createElement('button');
      delBtn.className = 'toolbar-btn';
      delBtn.style.fontSize = '11px';
      delBtn.style.padding = '4px 8px';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', function(ev) {
        ev.stopPropagation();
        if (!confirm('Delete "' + meta.title + '"? This cannot be undone.')) return;
        _deleteBracketFromStorage(meta.id);
        if (state.bracket && state.bracket.id === meta.id) {
          const remaining = _loadBracketIndex();
          if (remaining.length > 0) {
            remaining.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            switchToBracket(remaining[0].id);
          } else {
            const tempBr = createBracket(16, 'New Bracket');
            state.bracket = tempBr;
            _fullRenderCurrentBracket();
            hideDialog('brackets-dialog');
            openNewBracketDialog();
            return;
          }
        }
        openBracketsDialog(); // refresh list
      });

      entry.appendChild(left);
      entry.appendChild(delBtn);

      entry.addEventListener('click', function() {
        switchToBracket(meta.id);
        hideDialog('brackets-dialog');
      });

      entries.appendChild(entry);
    });
  }

  showDialog('brackets-dialog');
}

function switchToBracket(id) {
  const bracket = _loadBracket(id);
  if (!bracket) return;
  state.bracket = bracket;
  _fullRenderCurrentBracket();
}

// ── New Bracket Dialog ───────────────────────────────────────────────────

let newBracketSelectedSize = 16;

export function openNewBracketDialog() {
  newBracketSelectedSize = 16;
  document.getElementById('new-bracket-title-input').value = 'New Bracket';
  document.querySelectorAll('#new-bracket-size-toggles .size-toggle').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.getAttribute('data-size'), 10) === 16);
  });
  showDialog('new-bracket-dialog');
  document.getElementById('new-bracket-title-input').focus();
  document.getElementById('new-bracket-title-input').select();
}

function createNewBracketFromDialog() {
  const title = document.getElementById('new-bracket-title-input').value.trim() || 'New Bracket';
  const newBr = createBracket(newBracketSelectedSize, title);
  state.bracket = newBr;
  _saveBracket(newBr);
  _fullRenderCurrentBracket();
  hideDialog('new-bracket-dialog');
}

// ── Shuffle ──────────────────────────────────────────────────────────────

function shuffleFirstRound(bracket) {
  const { size } = bracket;
  const cellIds = [];
  for (let i = 0; i < size; i++) {
    const slotIndex = getSlotIndex(size, 0, i);
    cellIds.push(bracket.slots[slotIndex].cellId);
  }

  // Fisher-Yates shuffle
  for (let i = cellIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cellIds[i], cellIds[j]] = [cellIds[j], cellIds[i]];
  }

  for (let i = 0; i < size; i++) {
    const slotIndex = getSlotIndex(size, 0, i);
    bracket.slots[slotIndex].cellId = cellIds[i];
    if (cellIds[i] && bracket.cells[cellIds[i]]) {
      bracket.cells[cellIds[i]].sourceSlot = slotIndex;
    }
  }

  bracket.updatedAt = new Date().toISOString();
}

// ── setupDialogEvents ────────────────────────────────────────────────────

/**
 * Wire up all dialog event handlers. Call once during initialization.
 * Accepts storage functions to avoid circular imports.
 */
export function setupDialogEvents(storageFns) {
  _saveBracket = storageFns.saveBracket;
  _loadBracketIndex = storageFns.loadBracketIndex;
  _loadBracket = storageFns.loadBracket;
  _deleteBracketFromStorage = storageFns.deleteBracketFromStorage;
  _fullRenderCurrentBracket = storageFns.fullRenderCurrentBracket;

  // Initialize formatting state on state object
  state.formattingSlotIndex = null;

  // ── Settings button ──
  document.getElementById('btn-settings').addEventListener('click', function() {
    openSettingsDialog();
  });

  document.getElementById('settings-dialog-close').addEventListener('click', function() {
    hideDialog('settings-dialog');
  });

  // ── Dialog overlay ──
  document.getElementById('dialog-overlay').addEventListener('click', function() {
    hideAllDialogs();
  });

  // ── Escape key ──
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      hideAllDialogs();
      if (state.formattingSlotIndex !== null) {
        hideFormatPopover();
      }
    }
  });

  // ── Bracket size selection ──
  document.getElementById('size-toggles').addEventListener('click', function(e) {
    const btn = e.target.closest('.size-toggle');
    if (!btn) return;

    const newSize = parseInt(btn.getAttribute('data-size'), 10);
    const bracket = state.bracket;
    if (newSize === bracket.size) return;

    const oldSize = bracket.size;
    const hasData = Object.keys(bracket.cells).length > 0;

    if (hasData && newSize < oldSize) {
      if (!confirm(`Decreasing from ${oldSize} to ${newSize} will remove entries beyond slot ${newSize}. Continue?`)) return;
    }

    // Collect round-0 cell data from old bracket
    const oldRound0Cells = [];
    for (let i = 0; i < oldSize; i++) {
      const slotIndex = getSlotIndex(oldSize, 0, i);
      const slot = bracket.slots[slotIndex];
      if (slot && slot.cellId && bracket.cells[slot.cellId]) {
        oldRound0Cells.push({ index: i, cellId: slot.cellId, cell: bracket.cells[slot.cellId] });
      }
    }

    const newBracket = createBracket(newSize, bracket.title);
    newBracket.titleFont = bracket.titleFont;
    newBracket.backgroundColor = bracket.backgroundColor;
    newBracket.showSeedNumbers = bracket.showSeedNumbers;
    newBracket.layoutMode = bracket.layoutMode;

    for (const entry of oldRound0Cells) {
      if (entry.index < newSize) {
        const newSlotIndex = getSlotIndex(newSize, 0, entry.index);
        newBracket.cells[entry.cellId] = entry.cell;
        newBracket.slots[newSlotIndex].cellId = entry.cellId;
      }
    }

    state.bracket = newBracket;

    document.querySelectorAll('#size-toggles .size-toggle').forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-size'), 10) === newSize);
    });

    applyBracketStyles(state.bracket);
    renderBracket(state.bracket);
  });

  // ── Background color in settings ──
  document.getElementById('settings-bg-color-grid').addEventListener('click', function(e) {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;

    const color = swatch.getAttribute('data-color');
    state.bracket.backgroundColor = color;
    state.bracket.updatedAt = new Date().toISOString();

    this.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');

    applyBracketStyles(state.bracket);
  });

  // ── Seed numbers toggle ──
  document.getElementById('toggle-seed-numbers').addEventListener('change', function() {
    state.bracket.showSeedNumbers = this.checked;
    state.bracket.updatedAt = new Date().toISOString();
    renderBracket(state.bracket);
  });

  document.getElementById('toggle-auto-color').addEventListener('change', function() {
    state.bracket.autoColor = this.checked;
    state.bracket.updatedAt = new Date().toISOString();
  });

  // ── Layout toggle ──
  const layoutTogglesEl = document.getElementById('layout-toggles');
  if (layoutTogglesEl) {
    layoutTogglesEl.addEventListener('click', function(e) {
      const btn = e.target.closest('.size-toggle');
      if (!btn) return;
      const mode = btn.getAttribute('data-layout');
      if (mode === state.bracket.layoutMode) return;
      state.bracket.layoutMode = mode;
      state.bracket.updatedAt = new Date().toISOString();
      this.querySelectorAll('.size-toggle').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-layout') === mode);
      });
      renderBracket(state.bracket);
    });
  }

  // ── Font picker ──
  document.getElementById('font-picker-grid').addEventListener('click', function(e) {
    const card = e.target.closest('.font-option');
    if (!card) return;

    const fontFamily = card.getAttribute('data-font-family');
    const fontType = card.getAttribute('data-font-type');

    const apply = () => {
      state.bracket.titleFont = fontFamily;
      state.bracket.updatedAt = new Date().toISOString();

      document.getElementById('font-picker-grid').querySelectorAll('.font-option').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      applyFont(state.bracket);
      renderBracket(state.bracket);
    };

    if (fontType === 'google') {
      loadGoogleFont(fontFamily).then(apply);
    } else {
      apply();
    }
  });

  // ── Format popover ──
  document.getElementById('format-popover-close').addEventListener('click', function(e) {
    e.stopPropagation();
    hideFormatPopover();
  });

  document.getElementById('bracket-container').addEventListener('click', function(e) {
    const formatIcon = e.target.closest('.format-icon');
    if (formatIcon) {
      e.stopPropagation();
      const cellEl = formatIcon.closest('.cell');
      if (!cellEl) return;
      const slotIndex = parseInt(cellEl.getAttribute('data-slot-index'), 10);

      if (state.formattingSlotIndex === slotIndex) {
        hideFormatPopover();
      } else {
        // Confirm any active edit before showing format popover
        const { confirmEdit } = storageFns.editingFns || {};
        if (confirmEdit) {
          const { editingSlotIndex } = storageFns.editingFns;
          // We check via the module's exported state
        }
        showFormatPopover(slotIndex);
      }
      return;
    }
  });

  // Click on bg swatch in popover
  document.getElementById('format-popover').addEventListener('click', function(e) {
    e.stopPropagation();
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;

    const bracket = state.bracket;
    if (state.formattingSlotIndex === null) return;
    const slot = bracket.slots[state.formattingSlotIndex];
    if (!slot || !slot.cellId) return;
    const cell = bracket.cells[slot.cellId];
    if (!cell) return;

    const color = swatch.getAttribute('data-color');
    const type = swatch.getAttribute('data-type');

    if (type === 'bg') {
      cell.bgColor = color;
      cell.textColor = getAutoTextColor(color);
    }

    const savedSlot = state.formattingSlotIndex;
    renderBracket(bracket);
    showFormatPopover(savedSlot);
  });

  // Dismiss popover on click outside
  document.addEventListener('click', function(e) {
    if (state.formattingSlotIndex === null) return;
    const popover = document.getElementById('format-popover');
    if (popover.contains(e.target)) return;
    if (e.target.closest('.format-icon')) return;
    hideFormatPopover();
  });

  // ── Seed dialog ──
  document.getElementById('btn-seed').addEventListener('click', function() {
    openSeedDialog();
  });

  document.getElementById('seed-dialog-close').addEventListener('click', function() {
    hideDialog('seed-dialog');
  });

  document.getElementById('seed-textarea').addEventListener('input', updateSeedPreview);

  document.getElementById('seed-import-btn').addEventListener('click', function() {
    const bracket = state.bracket;
    const textarea = document.getElementById('seed-textarea');
    const text = textarea.value;
    const names = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);

    if (names.length === 0) return;

    const emptySlots = getEmptyFirstRoundSlots(bracket);

    // Collect already-used colors
    const usedColors = new Set();
    for (const cellId of Object.keys(bracket.cells)) {
      if (bracket.cells[cellId].bgColor) usedColors.add(bracket.cells[cellId].bgColor);
    }

    const count = Math.min(names.length, emptySlots.length);
    for (let i = 0; i < count; i++) {
      // Exclude matchup partner's color
      const slotData = bracket.slots[emptySlots[i]];
      const excludeColors = [];
      if (slotData && slotData.round === 0) {
        const partnerIdx = slotData.index ^ 1;
        const partnerSlotIndex = getSlotIndex(bracket.size, 0, partnerIdx);
        const partnerSlot = bracket.slots[partnerSlotIndex];
        if (partnerSlot && partnerSlot.cellId && bracket.cells[partnerSlot.cellId]) {
          excludeColors.push(bracket.cells[partnerSlot.cellId].bgColor);
        }
      }

      const color = bracket.autoColor !== false
        ? getRandomColor(usedColors, excludeColors)
        : '#ffffff';
      usedColors.add(color);
      const cell = createCell(names[i], color);
      cell.sourceSlot = emptySlots[i];
      bracket.cells[cell.id] = cell;
      bracket.slots[emptySlots[i]].cellId = cell.id;
    }

    bracket.updatedAt = new Date().toISOString();
    hideDialog('seed-dialog');
    renderBracket(bracket);
  });

  // ── Shuffle ──
  document.getElementById('btn-shuffle').addEventListener('click', function() {
    const bracket = state.bracket;
    if (hasTournamentStarted(bracket)) return;

    if (!confirm('Shuffle all first-round matchups? This can\'t be undone.')) return;

    shuffleFirstRound(bracket);
    renderBracket(bracket);
  });

  // ── Promote handler ──
  document.getElementById('bracket-container').addEventListener('click', function(e) {
    const promoteBtn = e.target.closest('.promote-btn');
    if (!promoteBtn) return;
    e.stopPropagation();

    const bracket = state.bracket;
    const slotIndex = parseInt(promoteBtn.getAttribute('data-slot-index'), 10);
    const slot = bracket.slots[slotIndex];
    if (!slot || !slot.cellId) return;

    const round = slot.round;
    const indexInRound = slot.index;
    const next = getNextSlot(bracket.size, round, indexInRound);
    if (!next) return;

    const nextSlotIndex = getSlotIndex(bracket.size, next.round, next.index);
    const nextSlot = bracket.slots[nextSlotIndex];
    if (nextSlot.cellId) return;

    nextSlot.cellId = slot.cellId;
    renderBracket(bracket);
  });

  // ── Demote handler ──
  document.getElementById('bracket-container').addEventListener('click', function(e) {
    const demoteBtn = e.target.closest('.demote-btn');
    if (!demoteBtn) return;
    e.stopPropagation();

    const bracket = state.bracket;
    const slotIndex = parseInt(demoteBtn.getAttribute('data-slot-index'), 10);
    const slot = bracket.slots[slotIndex];
    if (!slot) return;

    const cellId = slot.cellId;
    slot.cellId = null;

    if (cellId) {
      const round = slot.round;
      const totalRounds = getTotalRounds(bracket.size);
      for (let r = round + 1; r < totalRounds; r++) {
        const slotsInRound = getSlotsInRound(bracket.size, r);
        for (let idx = 0; idx < slotsInRound; idx++) {
          const si = getSlotIndex(bracket.size, r, idx);
          if (bracket.slots[si] && bracket.slots[si].cellId === cellId) {
            bracket.slots[si].cellId = null;
          }
        }
      }
    }

    renderBracket(bracket);
  });

  // ── Brackets dialog ──
  document.getElementById('btn-brackets').addEventListener('click', function() {
    openBracketsDialog();
  });

  document.getElementById('brackets-dialog-close').addEventListener('click', function() {
    hideDialog('brackets-dialog');
  });

  document.getElementById('new-bracket-btn').addEventListener('click', function() {
    hideDialog('brackets-dialog');
    openNewBracketDialog();
  });

  // ── New bracket dialog ──
  document.getElementById('new-bracket-dialog-close').addEventListener('click', function() {
    hideDialog('new-bracket-dialog');
  });

  document.getElementById('btn-new-toolbar').addEventListener('click', function() {
    openNewBracketDialog();
  });

  document.getElementById('new-bracket-size-toggles').addEventListener('click', function(e) {
    const btn = e.target.closest('.size-toggle');
    if (!btn) return;
    newBracketSelectedSize = parseInt(btn.getAttribute('data-size'), 10);
    this.querySelectorAll('.size-toggle').forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-size'), 10) === newBracketSelectedSize);
    });
  });

  document.getElementById('new-bracket-create-btn').addEventListener('click', createNewBracketFromDialog);

  document.getElementById('new-bracket-title-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      createNewBracketFromDialog();
    }
  });

  // ── Drag and drop ──
  let dragSourceSlotIndex = null;

  document.getElementById('bracket-container').addEventListener('dragstart', function(e) {
    const cellEl = e.target.closest('.cell');
    if (!cellEl || !cellEl.hasAttribute('draggable')) return;

    dragSourceSlotIndex = parseInt(cellEl.getAttribute('data-slot-index'), 10);
    cellEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragSourceSlotIndex));
  });

  document.getElementById('bracket-container').addEventListener('dragend', function(e) {
    const cellEl = e.target.closest('.cell');
    if (cellEl) cellEl.classList.remove('dragging');
    dragSourceSlotIndex = null;
    document.querySelectorAll('.cell.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  document.getElementById('bracket-container').addEventListener('dragover', function(e) {
    if (dragSourceSlotIndex === null) return;
    const cellEl = e.target.closest('.cell');
    if (!cellEl) return;
    const targetRound = parseInt(cellEl.getAttribute('data-round'), 10);
    const sourceRound = parseInt(
      document.querySelector(`.cell[data-slot-index="${dragSourceSlotIndex}"]`)?.getAttribute('data-round') || '0', 10
    );

    // Allow drop on: round-0 cells (swap), or the specific next-round slot (promote)
    if (targetRound === 0 && sourceRound === 0) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cellEl.classList.add('drag-over');
    } else if (targetRound === sourceRound + 1) {
      // Check this is the correct next slot for this source
      const sourceIdx = parseInt(
        document.querySelector(`.cell[data-slot-index="${dragSourceSlotIndex}"]`)?.getAttribute('data-index-in-round') || '0', 10
      );
      const next = getNextSlot(state.bracket.size, sourceRound, sourceIdx);
      if (next) {
        const nextSlotIdx = getSlotIndex(state.bracket.size, next.round, next.index);
        const targetSlotIdx = parseInt(cellEl.getAttribute('data-slot-index'), 10);
        if (nextSlotIdx === targetSlotIdx) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          cellEl.classList.add('drag-over');
        }
      }
    }
  });

  document.getElementById('bracket-container').addEventListener('dragleave', function(e) {
    const cellEl = e.target.closest('.cell');
    if (cellEl) cellEl.classList.remove('drag-over');
  });

  document.getElementById('bracket-container').addEventListener('drop', function(e) {
    e.preventDefault();
    if (dragSourceSlotIndex === null) return;

    const cellEl = e.target.closest('.cell');
    if (!cellEl) return;

    const targetSlotIndex = parseInt(cellEl.getAttribute('data-slot-index'), 10);
    const targetRound = parseInt(cellEl.getAttribute('data-round'), 10);
    if (targetSlotIndex === dragSourceSlotIndex) return;

    const bracket = state.bracket;
    const sourceSlot = bracket.slots[dragSourceSlotIndex];
    const targetSlot = bracket.slots[targetSlotIndex];
    if (!sourceSlot) return;

    const sourceRound = parseInt(
      document.querySelector(`.cell[data-slot-index="${dragSourceSlotIndex}"]`)?.getAttribute('data-round') || '0', 10
    );

    if (targetRound === 0 && sourceRound === 0) {
      // Round-0 swap
      const sourceCellId = sourceSlot.cellId;
      const targetCellId = targetSlot.cellId;
      sourceSlot.cellId = targetCellId;
      targetSlot.cellId = sourceCellId;
      if (sourceCellId && bracket.cells[sourceCellId]) {
        bracket.cells[sourceCellId].sourceSlot = targetSlotIndex;
      }
      if (targetCellId && bracket.cells[targetCellId]) {
        bracket.cells[targetCellId].sourceSlot = dragSourceSlotIndex;
      }
    } else if (targetRound === sourceRound + 1 && sourceSlot.cellId) {
      // Promote: drag cell to next round
      targetSlot.cellId = sourceSlot.cellId;
    } else {
      return; // invalid drop
    }

    dragSourceSlotIndex = null;
    renderBracket(bracket);
  });
}

