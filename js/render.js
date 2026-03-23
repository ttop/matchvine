import { calculateLayout } from './layout.js';
import {
  CELL_WIDTH, CELL_HEIGHT, CHAMP_WIDTH,
  ROUND_GAP, LEFT_PADDING, RIGHT_PADDING,
} from './constants.js';
import {
  getSlotsInRound, getSlotIndex, getTotalRounds,
  getMatchupPair, getNextSlot, getChampionSlotIndex,
  isLeftHalf, hasTournamentStarted,
} from './state.js';
import { escapeHtml } from './utils.js';

// ── Module-level save callback ───────────────────────────────────────────

let _onSaveCallback = null;

/**
 * Register a callback that runs after every renderBracket call.
 * Called by main.js during initialization to wire in saveBracket.
 */
export function setOnSave(fn) {
  _onSaveCallback = fn;
}

// ── autoSizeText (private helper) ────────────────────────────────────────

const BASE_FONT = 22;
const MIN_FONT = 11;

/**
 * Shrink font size on a .cell-text element until it fits within the cell.
 * Uses display: block (NOT flex). Only shrinks text longer than 3 chars.
 */
export function autoSizeText(cellDiv) {
  const textEl = cellDiv.querySelector('.cell-text');
  if (!textEl) return;

  // Reset to measure at base size
  textEl.style.fontSize = BASE_FONT + 'px';
  textEl.style.lineHeight = '1.2';
  textEl.style.padding = '4px 8px';
  textEl.style.overflow = 'hidden';

  // Short text always fits at base size
  const text = (textEl.textContent || '').trim();
  if (text.length <= 3) return;

  // For longer text, check if it actually overflows
  let fontSize = BASE_FONT;
  while (fontSize > MIN_FONT) {
    textEl.style.fontSize = fontSize + 'px';
    if (textEl.scrollHeight <= textEl.clientHeight && textEl.scrollWidth <= textEl.clientWidth) {
      break;
    }
    fontSize--;
  }
}

// ── renderBracket ────────────────────────────────────────────────────────

/**
 * Single clean render function that replaces the 4 monkey-patched layers
 * from the original index.html.
 *
 * Steps:
 * 1. Calculate layout
 * 2. Clear container, create bracket-inner wrapper
 * 3. Create SVG for connector lines
 * 4. Create cells with proper classes and data attributes
 * 5. Add .cell-text spans and auto-size text
 * 6. Add format icons to filled cells
 * 7. Add promote/demote buttons
 * 8. Set draggable on first-round filled cells (pre-tournament)
 * 9. Draw SVG connector lines
 * 10. Render round labels, seed numbers, bracket title display
 * 11. Update toolbar state
 * 12. Save bracket
 *
 * @param {object} bracket - The bracket data object
 * @param {object} [options] - Optional render options
 * @param {function} [options.onSave] - Called after render to persist bracket
 */
export function renderBracket(bracket, options) {
  const opts = options || {};
  const container = document.getElementById('bracket-container');
  const layout = calculateLayout(bracket);
  const { positions, posMap, totalWidth, totalHeight, championX } = layout;
  const { size } = bracket;
  const totalRounds = getTotalRounds(size);

  // ── 1. Clear container, create bracket-inner ──
  container.innerHTML = '';

  const bracketInner = document.createElement('div');
  bracketInner.id = 'bracket-inner';
  bracketInner.style.position = 'relative';
  bracketInner.style.width = totalWidth + 'px';
  bracketInner.style.height = totalHeight + 'px';
  bracketInner.style.transformOrigin = 'top left';
  container.appendChild(bracketInner);

  // ── 2. SVG element for connector lines ──
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', totalWidth);
  svg.setAttribute('height', totalHeight);
  svg.style.position = 'absolute';
  svg.style.left = '0';
  svg.style.top = '0';
  svg.style.pointerEvents = 'none';
  bracketInner.appendChild(svg);

  // ── 3. Cell wrapper ──
  const cellWrapper = document.createElement('div');
  cellWrapper.style.position = 'absolute';
  cellWrapper.style.left = '0';
  cellWrapper.style.top = '0';
  cellWrapper.style.width = totalWidth + 'px';
  cellWrapper.style.height = totalHeight + 'px';
  bracketInner.appendChild(cellWrapper);

  // ── 4. Collect promoted cell IDs for winner/loser styling ──
  const promotedCellIds = new Set();
  for (let round = 1; round < totalRounds; round++) {
    const slotsInRound = getSlotsInRound(size, round);
    for (let idx = 0; idx < slotsInRound; idx++) {
      const slotIndex = getSlotIndex(size, round, idx);
      const slot = bracket.slots[slotIndex];
      if (slot && slot.cellId) {
        promotedCellIds.add(slot.cellId);
      }
    }
  }

  const tournamentStarted = hasTournamentStarted(bracket);

  // ── 5. Render cells ──
  for (const pos of positions) {
    const slot = bracket.slots[pos.slotIndex];
    const cellEl = document.createElement('div');
    cellEl.className = 'cell';

    const isChamp = pos.isChampion;
    const cellWidth = isChamp ? CHAMP_WIDTH : CELL_WIDTH;

    // CSS classes
    if (!slot || !slot.cellId) {
      cellEl.classList.add('cell-empty');
    }
    if (isChamp) {
      cellEl.classList.add('cell-champion');
    }

    // Data attributes
    cellEl.setAttribute('data-slot-index', pos.slotIndex);
    cellEl.setAttribute('data-round', pos.round);
    cellEl.setAttribute('data-index-in-round', pos.indexInRound);

    // Inline positioning
    cellEl.style.left = pos.x + 'px';
    cellEl.style.top = pos.y + 'px';
    cellEl.style.width = cellWidth + 'px';

    if (slot && slot.cellId && bracket.cells[slot.cellId]) {
      const cell = bracket.cells[slot.cellId];

      // Inline colors
      cellEl.style.backgroundColor = cell.bgColor || '#ffffff';
      cellEl.style.color = cell.textColor || '#1a1a1a';

      // Winner/loser styling
      if (pos.round < totalRounds - 1 && promotedCellIds.has(slot.cellId)) {
        const next = getNextSlot(size, pos.round, pos.indexInRound);
        if (next) {
          const nextSlotIndex = getSlotIndex(size, next.round, next.index);
          const nextSlot = bracket.slots[nextSlotIndex];
          if (nextSlot && nextSlot.cellId === slot.cellId) {
            cellEl.classList.add('cell-winner');
          } else if (nextSlot && nextSlot.cellId && nextSlot.cellId !== slot.cellId) {
            cellEl.classList.add('cell-loser');
          }
        }
      }

      // Cell text with .cell-text span
      const textContent = cell.text || '';
      const safeText = escapeHtml(textContent).replace(/\n/g, '<br>');
      const textSpan = document.createElement('span');
      textSpan.className = 'cell-text';
      if (isChamp) {
        textSpan.innerHTML = '<span style="margin-right:4px">\u{1F3C6}</span>' + safeText;
      } else {
        textSpan.innerHTML = safeText;
      }
      cellEl.appendChild(textSpan);

      // Format icon
      const formatIcon = document.createElement('span');
      formatIcon.className = 'format-icon';
      formatIcon.textContent = '\u{1F3A8}';
      cellEl.appendChild(formatIcon);

      // Promote button
      if (pos.round < totalRounds - 1) {
        const next = getNextSlot(size, pos.round, pos.indexInRound);
        if (next) {
          const nextSlotIndex = getSlotIndex(size, next.round, next.index);
          const nextSlot = bracket.slots[nextSlotIndex];

          if (!nextSlot || !nextSlot.cellId) {
            const promoteBtn = document.createElement('div');
            promoteBtn.className = 'promote-btn';
            promoteBtn.setAttribute('data-action', 'promote');
            promoteBtn.setAttribute('data-slot-index', pos.slotIndex);

            const leftHalf = isLeftHalf(size, pos.round, pos.indexInRound);
            if (leftHalf) {
              promoteBtn.textContent = '\u203A'; // ›
              promoteBtn.style.right = '-13px';
              promoteBtn.style.top = (CELL_HEIGHT / 2 - 13) + 'px';
            } else {
              promoteBtn.textContent = '\u2039'; // ‹
              promoteBtn.style.left = '-13px';
              promoteBtn.style.top = (CELL_HEIGHT / 2 - 13) + 'px';
            }

            cellEl.style.overflow = 'visible';
            cellEl.appendChild(promoteBtn);
          }
        }
      }

      // Demote button for promoted cells (round > 0)
      if (pos.round > 0) {
        const demoteBtn = document.createElement('div');
        demoteBtn.className = 'demote-btn';
        demoteBtn.setAttribute('data-action', 'demote');
        demoteBtn.setAttribute('data-slot-index', pos.slotIndex);
        demoteBtn.textContent = '\u00D7'; // ×
        cellEl.style.overflow = 'visible';
        cellEl.appendChild(demoteBtn);
      }

      // Draggable for first-round filled cells (pre-tournament)
      if (pos.round === 0 && !tournamentStarted) {
        cellEl.setAttribute('draggable', 'true');
      }

    } else {
      // Empty slot — show placeholder text in .cell-text span
      const textSpan = document.createElement('span');
      textSpan.className = 'cell-text';
      if (isChamp) {
        textSpan.textContent = '\u{1F3C6}';
      } else {
        textSpan.textContent = '?';
      }
      cellEl.appendChild(textSpan);
    }

    cellWrapper.appendChild(cellEl);

    // Auto-size text
    autoSizeText(cellEl);
  }

  // ── 6. Draw SVG connector lines ──
  const strokeColor = '#9ca3af';
  const strokeWidth = '1.5';

  function svgLine(x1, y1, x2, y2) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', strokeColor);
    line.setAttribute('stroke-width', strokeWidth);
    svg.appendChild(line);
  }

  const isStaggered = bracket.layoutMode === 'staggered';

  for (const pos of positions) {
    if (pos.round === 0) continue;

    const feeders = getMatchupPair(size, pos.round, pos.indexInRound);
    if (!feeders) continue;

    const feederA = posMap[feeders[0]];
    const feederB = posMap[feeders[1]];
    if (!feederA || !feederB) continue;

    const cellWidth = pos.isChampion ? CHAMP_WIDTH : CELL_WIDTH;
    const midY = pos.y + CELL_HEIGHT / 2;
    const feederAMidY = feederA.y + CELL_HEIGHT / 2;
    const feederBMidY = feederB.y + CELL_HEIGHT / 2;

    if (isStaggered && !pos.isChampion) {
      // Staggered lines: horizontal from feeder edge to winner midX, then vertical to winner edge
      const winnerMidX = pos.x + CELL_WIDTH / 2;

      if (pos.isLeftHalf) {
        // Top feeder: horizontal right to winnerMidX, then vertical down to winner top
        svgLine(feederA.x + CELL_WIDTH, feederAMidY, winnerMidX, feederAMidY);
        svgLine(winnerMidX, feederAMidY, winnerMidX, pos.y);
        // Bottom feeder: horizontal right to winnerMidX, then vertical up to winner bottom
        svgLine(feederB.x + CELL_WIDTH, feederBMidY, winnerMidX, feederBMidY);
        svgLine(winnerMidX, feederBMidY, winnerMidX, pos.y + CELL_HEIGHT);
      } else {
        // Right half: horizontal left to winnerMidX, then vertical
        svgLine(feederA.x, feederAMidY, winnerMidX, feederAMidY);
        svgLine(winnerMidX, feederAMidY, winnerMidX, pos.y);
        svgLine(feederB.x, feederBMidY, winnerMidX, feederBMidY);
        svgLine(winnerMidX, feederBMidY, winnerMidX, pos.y + CELL_HEIGHT);
      }

    } else if (pos.isChampion) {
      const leftFeeder = feederA.isLeftHalf ? feederA : feederB;
      const rightFeeder = feederA.isLeftHalf ? feederB : feederA;

      // Left feeder -> champion
      const ljx = leftFeeder.x + CELL_WIDTH + (pos.x - (leftFeeder.x + CELL_WIDTH)) / 2;
      const leftMidY = leftFeeder.y + CELL_HEIGHT / 2;
      svgLine(leftFeeder.x + CELL_WIDTH, leftMidY, ljx, leftMidY);
      svgLine(ljx, leftMidY, ljx, midY);
      svgLine(ljx, midY, pos.x, midY);

      // Right feeder -> champion
      const rjx = rightFeeder.x - (rightFeeder.x - (pos.x + CHAMP_WIDTH)) / 2;
      const rightMidY = rightFeeder.y + CELL_HEIGHT / 2;
      svgLine(rightFeeder.x, rightMidY, rjx, rightMidY);
      svgLine(rjx, rightMidY, rjx, midY);
      svgLine(rjx, midY, pos.x + CHAMP_WIDTH, midY);

    } else if (pos.isLeftHalf) {
      const jx = feederA.x + CELL_WIDTH + (pos.x - (feederA.x + CELL_WIDTH)) / 2;
      svgLine(feederA.x + CELL_WIDTH, feederAMidY, jx, feederAMidY);
      svgLine(feederB.x + CELL_WIDTH, feederBMidY, jx, feederBMidY);
      svgLine(jx, feederAMidY, jx, feederBMidY);
      svgLine(jx, midY, pos.x, midY);

    } else {
      const jx = feederA.x - (feederA.x - (pos.x + CELL_WIDTH)) / 2;
      svgLine(feederA.x, feederAMidY, jx, feederAMidY);
      svgLine(feederB.x, feederBMidY, jx, feederBMidY);
      svgLine(jx, feederAMidY, jx, feederBMidY);
      svgLine(jx, midY, pos.x + CELL_WIDTH, midY);
    }
  }

  // ── 7. Round labels ──
  const halfSize = size / 2;
  const roundsPerHalf = Math.log2(halfSize) + 1;
  const labelY = totalHeight - 30;

  function getHalfRoundLabel(round, roundsInHalf) {
    if (round === roundsInHalf - 1) return 'Semis';
    return 'Round ' + (round + 1);
  }

  // Position labels based on actual cell x positions (works for both classic and staggered)
  for (let r = 0; r < roundsPerHalf; r++) {
    // Find the first left-half cell in this round to get the x position
    const leftCell = positions.find(p => p.round === r && p.isLeftHalf);
    if (leftCell) {
      const labelEl = document.createElement('div');
      labelEl.className = 'round-label';
      labelEl.style.left = leftCell.x + 'px';
      labelEl.style.top = labelY + 'px';
      labelEl.style.width = CELL_WIDTH + 'px';
      labelEl.textContent = getHalfRoundLabel(r, roundsPerHalf);
      cellWrapper.appendChild(labelEl);
    }

    // Find the first right-half cell in this round
    const rightCell = positions.find(p => p.round === r && !p.isLeftHalf && !p.isChampion);
    if (rightCell) {
      const labelEl = document.createElement('div');
      labelEl.className = 'round-label';
      labelEl.style.left = rightCell.x + 'px';
      labelEl.style.top = labelY + 'px';
      labelEl.style.width = CELL_WIDTH + 'px';
      labelEl.textContent = getHalfRoundLabel(r, roundsPerHalf);
      cellWrapper.appendChild(labelEl);
    }
  }

  // Champion label
  {
    const labelEl = document.createElement('div');
    labelEl.className = 'round-label';
    labelEl.style.left = championX + 'px';
    labelEl.style.top = labelY + 'px';
    labelEl.style.width = CHAMP_WIDTH + 'px';
    labelEl.textContent = 'Final';
    cellWrapper.appendChild(labelEl);
  }

  // ── 8. Seed numbers ──
  if (bracket.showSeedNumbers) {
    for (let i = 0; i < size; i++) {
      const slotIndex = getSlotIndex(size, 0, i);
      const pos = posMap[slotIndex];
      if (!pos) continue;

      const seedEl = document.createElement('div');
      seedEl.className = 'seed-number';
      seedEl.textContent = '#' + (i + 1);
      seedEl.style.top = (pos.y + CELL_HEIGHT / 2 - 7) + 'px';

      if (pos.isLeftHalf) {
        seedEl.style.left = (pos.x - 34) + 'px';
      } else {
        seedEl.style.left = (pos.x + CELL_WIDTH + 14) + 'px';
      }

      cellWrapper.appendChild(seedEl);
    }
  }

  // ── 9. Bracket title display ──
  if (bracket.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'bracket-title-display';
    titleEl.textContent = bracket.title;
    const titleWidth = 400;
    const champSlotPos = posMap[getChampionSlotIndex(size)];
    const champY = champSlotPos ? champSlotPos.y : 0;
    titleEl.style.left = (championX + CHAMP_WIDTH / 2 - titleWidth / 2) + 'px';
    titleEl.style.width = titleWidth + 'px';
    titleEl.style.top = (champY / 2 - 25) + 'px';
    titleEl.addEventListener('click', function() {
      const titleInput = document.getElementById('bracket-title');
      if (titleInput) titleInput.focus();
    });
    cellWrapper.appendChild(titleEl);
  }

  // ── 10. Update toolbar state ──
  const shuffleBtn = document.getElementById('btn-shuffle');
  if (shuffleBtn) {
    if (tournamentStarted) {
      shuffleBtn.classList.add('disabled');
    } else {
      shuffleBtn.classList.remove('disabled');
    }
  }

  const titleInput = document.getElementById('bracket-title');
  if (titleInput) {
    titleInput.textContent = bracket.title;
  }

  // ── 11. Save bracket ──
  if (opts.onSave) {
    opts.onSave(bracket);
  } else if (_onSaveCallback) {
    _onSaveCallback(bracket);
  }
}
