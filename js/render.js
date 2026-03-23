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
const MIN_FONT = 10;

/**
 * Shrink font size on a .cell-text element until it fits within the cell.
 * Uses an off-screen measurement span for reliable sizing with display:block.
 */
export function autoSizeText(cellDiv) {
  const textEl = cellDiv.querySelector('.cell-text');
  if (!textEl) return;

  const text = (textEl.textContent || '').trim();
  if (text.length <= 3) {
    textEl.style.fontSize = BASE_FONT + 'px';
    return;
  }

  const maxW = cellDiv.clientWidth - 16;  // padding
  const maxH = cellDiv.clientHeight - 8;

  // Create a hidden measurement span
  const measure = document.createElement('span');
  measure.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;';
  measure.textContent = textEl.textContent;
  document.body.appendChild(measure);

  let fontSize = BASE_FONT;

  // Shrink until single-line width fits, then check if wrapping fits height
  while (fontSize > MIN_FONT) {
    measure.style.fontSize = fontSize + 'px';
    measure.style.whiteSpace = 'nowrap';
    measure.style.width = '';
    const singleLineWidth = measure.offsetWidth;

    if (singleLineWidth <= maxW) {
      // Single line fits — use this size
      break;
    }

    // Check if wrapped text fits the height
    measure.style.whiteSpace = 'normal';
    measure.style.width = maxW + 'px';
    measure.style.lineHeight = '1.2';
    if (measure.offsetHeight <= maxH) {
      break;
    }

    fontSize--;
  }

  document.body.removeChild(measure);
  textEl.style.fontSize = fontSize + 'px';
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
      // On right-half cells, put format icon on the right to avoid overlapping promote button
      if (!pos.isLeftHalf && !pos.isChampion) {
        formatIcon.style.left = 'auto';
        formatIcon.style.right = '4px';
      }
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

      // Demote button only on the MOST ADVANCED cell in a track (not on earlier rounds)
      if (pos.round > 0) {
        const nextForDemote = getNextSlot(size, pos.round, pos.indexInRound);
        let isLastInTrack = true;
        if (nextForDemote) {
          const nextIdx = getSlotIndex(size, nextForDemote.round, nextForDemote.index);
          const nextSl = bracket.slots[nextIdx];
          if (nextSl && nextSl.cellId === slot.cellId) {
            isLastInTrack = false; // this cell appears in the next round too
          }
        }
        if (isLastInTrack) {
          const demoteBtn = document.createElement('div');
          demoteBtn.className = 'demote-btn';
          demoteBtn.setAttribute('data-action', 'demote');
          demoteBtn.setAttribute('data-slot-index', pos.slotIndex);
          demoteBtn.textContent = '\u00D7'; // ×
          cellEl.style.overflow = 'visible';
          cellEl.appendChild(demoteBtn);
        }
      }

      // Draggable for filled cells whose next-round slot is empty
      // Round 0: can drag to swap with other round-0 cells OR drag to promote
      // Round 1+: can only drag to promote (to next round)
      const next = getNextSlot(size, pos.round, pos.indexInRound);
      if (next) {
        const nextSlotIdx = getSlotIndex(size, next.round, next.index);
        const nextSlot = bracket.slots[nextSlotIdx];
        if (!nextSlot || !nextSlot.cellId) {
          cellEl.setAttribute('draggable', 'true');
          cellEl.setAttribute('data-can-promote', 'true');
        }
      }
      // Round 0 cells without promotion can still drag to swap
      if (pos.round === 0 && !cellEl.hasAttribute('draggable')) {
        const next2 = getNextSlot(size, 0, pos.indexInRound);
        const nextSlotIdx2 = next2 ? getSlotIndex(size, next2.round, next2.index) : -1;
        const nextSlot2 = nextSlotIdx2 >= 0 ? bracket.slots[nextSlotIdx2] : null;
        if (!nextSlot2 || !nextSlot2.cellId) {
          cellEl.setAttribute('draggable', 'true');
        }
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
      const champMidX = pos.x + CHAMP_WIDTH / 2;

      if (isStaggered) {
        // Staggered: lines from semis go horizontal then vertical to champion's top/bottom at its horizontal midpoint
        const leftMidY = leftFeeder.y + CELL_HEIGHT / 2;
        const rightMidY = rightFeeder.y + CELL_HEIGHT / 2;
        // Left semi → champion top edge at midpoint
        svgLine(leftFeeder.x + CELL_WIDTH, leftMidY, champMidX, leftMidY);
        svgLine(champMidX, leftMidY, champMidX, pos.y);
        // Right semi → champion bottom edge at midpoint
        svgLine(rightFeeder.x, rightMidY, champMidX, rightMidY);
        svgLine(champMidX, rightMidY, champMidX, pos.y + CELL_HEIGHT);
      } else {
        // Classic: horizontal bracket lines to champion left/right edges
        const ljx = leftFeeder.x + CELL_WIDTH + (pos.x - (leftFeeder.x + CELL_WIDTH)) / 2;
        const leftMidY = leftFeeder.y + CELL_HEIGHT / 2;
        svgLine(leftFeeder.x + CELL_WIDTH, leftMidY, ljx, leftMidY);
        svgLine(ljx, leftMidY, ljx, midY);
        svgLine(ljx, midY, pos.x, midY);

        const rjx = rightFeeder.x - (rightFeeder.x - (pos.x + CHAMP_WIDTH)) / 2;
        const rightMidY = rightFeeder.y + CELL_HEIGHT / 2;
        svgLine(rightFeeder.x, rightMidY, rjx, rightMidY);
        svgLine(rjx, rightMidY, rjx, midY);
        svgLine(rjx, midY, pos.x + CHAMP_WIDTH, midY);
      }

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
    if (round === roundsInHalf - 1) return 'Finals';
    if (round === roundsInHalf - 2) return 'Semifinals';
    if (round === roundsInHalf - 3) return 'Quarterfinals';
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
    labelEl.textContent = 'Champion';
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

  // ── 9. Bracket title display (editable in-place) ──
  {
    const titleEl = document.createElement('div');
    titleEl.className = 'bracket-title-display';
    titleEl.textContent = bracket.title || 'Untitled Bracket';
    titleEl.setAttribute('contenteditable', 'true');
    titleEl.setAttribute('spellcheck', 'false');
    const titleWidth = 400;
    const champSlotPos = posMap[getChampionSlotIndex(size)];
    const champY = champSlotPos ? champSlotPos.y : 0;
    titleEl.style.left = (championX + CHAMP_WIDTH / 2 - titleWidth / 2) + 'px';
    titleEl.style.width = titleWidth + 'px';
    titleEl.style.top = '10px';

    let titleBeforeEdit = bracket.title || '';

    titleEl.addEventListener('focus', function() {
      titleBeforeEdit = this.textContent;
    });

    titleEl.addEventListener('blur', function() {
      const newTitle = this.textContent.trim();
      if (newTitle && newTitle !== titleBeforeEdit) {
        bracket.title = newTitle;
        bracket.updatedAt = new Date().toISOString();
        if (_onSaveCallback) _onSaveCallback(bracket);
      } else if (!newTitle) {
        this.textContent = titleBeforeEdit;
      }
    });

    titleEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.blur();
      } else if (e.key === 'Escape') {
        this.textContent = titleBeforeEdit;
        this.blur();
      }
    });

    // Prevent click from propagating to bracket container (which could trigger edit-confirm)
    titleEl.addEventListener('click', function(e) {
      e.stopPropagation();
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

  // ── 11. Save bracket ──
  if (opts.onSave) {
    opts.onSave(bracket);
  } else if (_onSaveCallback) {
    _onSaveCallback(bracket);
  }
}
