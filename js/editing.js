import { state, createCell, getSlotIndex, getMatchupPair } from './state.js';
import { renderBracket } from './render.js';
import { autoSizeText } from './render.js';
import { getRandomColor } from './utils.js';

// ── Editing state ────────────────────────────────────────────────────────

export let editingSlotIndex = null;
export let beforeEditText = null;

// ── exitEditMode ─────────────────────────────────────────────────────────

export function exitEditMode() {
  if (editingSlotIndex === null) return;

  const container = document.getElementById('bracket-container');
  const cellEl = container.querySelector(
    `.cell[data-slot-index="${editingSlotIndex}"]`
  );
  if (cellEl) {
    cellEl.classList.remove('cell-editing');
    const textEl = cellEl.querySelector('.cell-text');
    if (textEl) {
      textEl.contentEditable = 'false';
    }
  }

  editingSlotIndex = null;
  beforeEditText = null;
}

// ── confirmEdit ──────────────────────────────────────────────────────────

export function confirmEdit() {
  if (editingSlotIndex === null) return;

  const container = document.getElementById('bracket-container');
  const cellEl = container.querySelector(
    `.cell[data-slot-index="${editingSlotIndex}"]`
  );

  if (cellEl) {
    const textEl = cellEl.querySelector('.cell-text');
    if (!textEl) {
      const slotIdx = editingSlotIndex;
      exitEditMode();
      renderBracket(state.bracket);
      return;
    }
    // Extract text, converting <br> back to \n
    let rawHtml = textEl.innerHTML;
    rawHtml = rawHtml.replace(/<br\s*\/?>/gi, '\n');
    // Strip any other HTML tags
    const tmp = document.createElement('div');
    tmp.innerHTML = rawHtml;
    const newText = (tmp.textContent || '').replace(/^[\s\n\r]+|[\s\n\r]+$/g, '');

    const bracket = state.bracket;
    const slot = bracket.slots[editingSlotIndex];
    if (slot && slot.cellId && bracket.cells[slot.cellId]) {
      if (newText === '') {
        // Empty text — remove the cell entirely
        delete bracket.cells[slot.cellId];
        slot.cellId = null;
      } else {
        bracket.cells[slot.cellId].text = newText;
      }
    }
  }

  const slotIdx = editingSlotIndex;
  exitEditMode();
  renderBracket(state.bracket);

  // Re-apply auto-sizing to the confirmed cell
  const updatedCellEl = document.getElementById('bracket-container').querySelector(
    `.cell[data-slot-index="${slotIdx}"]`
  );
  if (updatedCellEl) {
    autoSizeText(updatedCellEl);
  }
}

// ── enterEditMode ────────────────────────────────────────────────────────

/**
 * Enters edit mode for a cell. For empty cells, creates a cell in the data
 * model and modifies the DOM directly — does NOT call renderBracket.
 */
export function enterEditMode(slotIndex) {
  const bracket = state.bracket;
  const slot = bracket.slots[slotIndex];
  const wasEmpty = !slot.cellId;

  // If empty slot, create a cell in the data model but DON'T re-render.
  // Instead, modify the existing DOM cell directly.
  if (wasEmpty) {
    // Collect used colors across the bracket
    const usedColors = new Set();
    for (const cellId of Object.keys(bracket.cells)) {
      if (bracket.cells[cellId].bgColor) usedColors.add(bracket.cells[cellId].bgColor);
    }

    // Exclude the matchup partner's color (round-0 pairs: i ^ 1)
    const excludeColors = [];
    if (slot.round === 0) {
      const partnerIdx = slot.index ^ 1;
      const partnerSlotIndex = getSlotIndex(bracket.size, 0, partnerIdx);
      const partnerSlot = bracket.slots[partnerSlotIndex];
      if (partnerSlot && partnerSlot.cellId && bracket.cells[partnerSlot.cellId]) {
        excludeColors.push(bracket.cells[partnerSlot.cellId].bgColor);
      }
    }

    const color = getRandomColor(usedColors, excludeColors);
    const newCell = createCell('', color);
    bracket.cells[newCell.id] = newCell;
    slot.cellId = newCell.id;
  }

  editingSlotIndex = slotIndex;
  const cell = bracket.cells[slot.cellId];
  beforeEditText = cell ? cell.text : '';

  // Directly modify the existing DOM cell (no re-render!)
  const container = document.getElementById('bracket-container');
  const cellEl = container.querySelector(`.cell[data-slot-index="${slotIndex}"]`);
  if (!cellEl) return;

  // Apply color directly to DOM
  if (wasEmpty) {
    cellEl.style.backgroundColor = cell.bgColor;
    cellEl.style.color = cell.textColor;
    cellEl.classList.remove('cell-empty');
  }

  // Get or create the text span
  let textEl = cellEl.querySelector('.cell-text');
  if (!textEl) {
    textEl = document.createElement('span');
    textEl.className = 'cell-text';
    cellEl.innerHTML = '';
    cellEl.appendChild(textEl);
  }

  // Clear placeholder text
  if (wasEmpty || textEl.textContent === '?') {
    textEl.textContent = '';
  }

  cellEl.classList.add('cell-editing');
  textEl.contentEditable = 'true';
  textEl.spellcheck = false;
  textEl.setAttribute('spellcheck', 'false');

  // Keydown handler for Enter/Escape (capture phase)
  textEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      confirmEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      const bracket = state.bracket;
      const slot = bracket.slots[editingSlotIndex];
      if (slot && slot.cellId && bracket.cells[slot.cellId]) {
        if (!beforeEditText) {
          delete bracket.cells[slot.cellId];
          slot.cellId = null;
        } else {
          bracket.cells[slot.cellId].text = beforeEditText;
        }
      }
      exitEditMode();
      renderBracket(bracket);
    }
  }, true);

  // Focus immediately — no setTimeout needed since we didn't re-render
  textEl.focus();
}

// ── setupEditingEvents ───────────────────────────────────────────────────

/**
 * Attach click delegation for cell editing and click-outside-to-confirm.
 * Call once during initialization.
 */
export function setupEditingEvents(container) {
  // Click delegation on bracket container for cell editing
  container.addEventListener('click', function(e) {
    const cellEl = e.target.closest('.cell');

    if (!cellEl) {
      // Clicked on empty space — confirm any active edit
      if (editingSlotIndex !== null) {
        confirmEdit();
      }
      return;
    }

    // Ignore clicks on format icon, promote button, or demote button
    if (e.target.closest('.format-icon') || e.target.closest('.promote-btn') || e.target.closest('.demote-btn')) {
      return;
    }

    const slotIndex = parseInt(cellEl.getAttribute('data-slot-index'), 10);
    const round = parseInt(cellEl.getAttribute('data-round'), 10);

    // Only allow editing in round 0. Later rounds are filled via promote only.
    if (round > 0) {
      return;
    }

    if (editingSlotIndex !== null && editingSlotIndex !== slotIndex) {
      // Clicking a different cell: confirm current edit first
      confirmEdit();
    }

    if (editingSlotIndex !== slotIndex) {
      enterEditMode(slotIndex);
    }
  });

  // Click outside bracket container to confirm
  document.addEventListener('click', function(e) {
    if (editingSlotIndex === null) return;

    // If click is outside the bracket container entirely, confirm
    if (!container.contains(e.target)) {
      confirmEdit();
    }
  });
}
