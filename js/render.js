import { calculateLayout } from './layout.js';
import {
  CELL_WIDTH, CELL_HEIGHT, CHAMP_WIDTH,
  ROUND_GAP, LEFT_PADDING, RIGHT_PADDING,
} from './constants.js';
import {
  getSlotsInRound, getSlotIndex, getTotalRounds,
  getMatchupPair, getNextSlot, getChampionSlotIndex,
  isLeftHalf, hasTournamentStarted, getQuadrantSeedRank,
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

  // Use CELL_WIDTH constant for consistency (clientWidth varies with border thickness)
  const isChamp = cellDiv.classList.contains('cell-champion');
  const baseWidth = isChamp ? CHAMP_WIDTH : CELL_WIDTH;
  const maxW = baseWidth - 20;  // padding
  const maxH = CELL_HEIGHT - 10;

  // Create a hidden measurement span that inherits the cell's font
  const measure = document.createElement('span');
  const computedFont = getComputedStyle(cellDiv).fontFamily;
  measure.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-family:' + computedFont + ';';
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

  // Collect loser cellIds — cells that lost a matchup (opponent was promoted instead)
  const loserCellIds = new Set();
  for (let round = 1; round < totalRounds; round++) {
    const slotsInRound = getSlotsInRound(size, round);
    for (let idx = 0; idx < slotsInRound; idx++) {
      const slotIndex = getSlotIndex(size, round, idx);
      const slot = bracket.slots[slotIndex];
      if (slot && slot.cellId) {
        // This slot has a winner — find the feeders and mark the loser
        const feeders = getMatchupPair(size, round, idx);
        if (feeders) {
          for (const feederIdx of feeders) {
            const feederSlot = bracket.slots[feederIdx];
            if (feederSlot && feederSlot.cellId && feederSlot.cellId !== slot.cellId) {
              loserCellIds.add(feederSlot.cellId);
            }
          }
        }
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
      // Check if this cell lost — its cellId appears in a matchup where a different cell was promoted
      if (loserCellIds.has(slot.cellId)) {
        cellEl.classList.add('cell-loser');
      } else if (pos.round < totalRounds - 1 && promotedCellIds.has(slot.cellId)) {
        const next = getNextSlot(size, pos.round, pos.indexInRound);
        if (next) {
          const nextSlotIndex = getSlotIndex(size, next.round, next.index);
          const nextSlot = bracket.slots[nextSlotIndex];
          if (nextSlot && nextSlot.cellId === slot.cellId) {
            cellEl.classList.add('cell-winner');
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

      // Format icon — tiny 3×2 color swatch grid
      const formatIcon = document.createElement('span');
      formatIcon.className = 'format-icon';
      const grid = document.createElement('span');
      grid.className = 'format-icon-grid';
      const swatchColors = ['#ef4444', '#eab308', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899'];
      for (const c of swatchColors) {
        const s = document.createElement('span');
        s.className = 'format-icon-swatch';
        s.style.backgroundColor = c;
        grid.appendChild(s);
      }
      formatIcon.appendChild(grid);
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
              promoteBtn.textContent = '\u00BB'; // »
              promoteBtn.style.right = '-26px';
            } else {
              promoteBtn.textContent = '\u00AB'; // «
              promoteBtn.style.left = '-26px';
              promoteBtn.classList.add('promote-left');
            }


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
          const leftHalfDemote = isLeftHalf(size, pos.round, pos.indexInRound);
          // Demote goes on the opposite side from promote (pointing back)
          if (leftHalfDemote) {
            demoteBtn.textContent = '\u00AB'; // « (points left = back)
            demoteBtn.style.left = '-26px';
          } else {
            demoteBtn.textContent = '\u00BB'; // » (points right = back)
            demoteBtn.style.right = '-26px';
            demoteBtn.classList.add('demote-right');
          }
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
  const defaultStrokeColor = '#d1d5db';
  const defaultStrokeWidth = '1.5';
  const winnerStrokeColor = '#6b7280';
  const winnerStrokeWidth = '2.5';

  function svgLine(x1, y1, x2, y2, bold) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', bold ? winnerStrokeColor : defaultStrokeColor);
    line.setAttribute('stroke-width', bold ? winnerStrokeWidth : defaultStrokeWidth);
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

    const slot = bracket.slots[pos.slotIndex];
    const cellWidth = pos.isChampion ? CHAMP_WIDTH : CELL_WIDTH;
    const midY = pos.y + CELL_HEIGHT / 2;
    const feederAMidY = feederA.y + CELL_HEIGHT / 2;
    const feederBMidY = feederB.y + CELL_HEIGHT / 2;

    // Determine which feeder lines should be bold (winner's path)
    const winnerId = slot && slot.cellId ? slot.cellId : null;
    const feederASlot = bracket.slots[feeders[0]];
    const feederBSlot = bracket.slots[feeders[1]];
    const boldA = winnerId && feederASlot && feederASlot.cellId === winnerId && !loserCellIds.has(winnerId);
    const boldB = winnerId && feederBSlot && feederBSlot.cellId === winnerId && !loserCellIds.has(winnerId);

    if (isStaggered && !pos.isChampion) {
      const winnerMidX = pos.x + CELL_WIDTH / 2;

      if (pos.isLeftHalf) {
        svgLine(feederA.x + CELL_WIDTH, feederAMidY, winnerMidX, feederAMidY, boldA);
        svgLine(winnerMidX, feederAMidY, winnerMidX, pos.y, boldA);
        svgLine(feederB.x + CELL_WIDTH, feederBMidY, winnerMidX, feederBMidY, boldB);
        svgLine(winnerMidX, feederBMidY, winnerMidX, pos.y + CELL_HEIGHT, boldB);
      } else {
        svgLine(feederA.x, feederAMidY, winnerMidX, feederAMidY, boldA);
        svgLine(winnerMidX, feederAMidY, winnerMidX, pos.y, boldA);
        svgLine(feederB.x, feederBMidY, winnerMidX, feederBMidY, boldB);
        svgLine(winnerMidX, feederBMidY, winnerMidX, pos.y + CELL_HEIGHT, boldB);
      }

    } else if (pos.isChampion) {
      const leftFeeder = feederA.isLeftHalf ? feederA : feederB;
      const rightFeeder = feederA.isLeftHalf ? feederB : feederA;
      const leftFeederSlot = feederA.isLeftHalf ? feederASlot : feederBSlot;
      const rightFeederSlot = feederA.isLeftHalf ? feederBSlot : feederASlot;
      const boldLeft = winnerId && leftFeederSlot && leftFeederSlot.cellId === winnerId && !loserCellIds.has(winnerId);
      const boldRight = winnerId && rightFeederSlot && rightFeederSlot.cellId === winnerId && !loserCellIds.has(winnerId);
      const champMidX = pos.x + CHAMP_WIDTH / 2;

      if (isStaggered) {
        const leftMidY = leftFeeder.y + CELL_HEIGHT / 2;
        const rightMidY = rightFeeder.y + CELL_HEIGHT / 2;
        svgLine(leftFeeder.x + CELL_WIDTH, leftMidY, champMidX, leftMidY, boldLeft);
        svgLine(champMidX, leftMidY, champMidX, pos.y, boldLeft);
        svgLine(rightFeeder.x, rightMidY, champMidX, rightMidY, boldRight);
        svgLine(champMidX, rightMidY, champMidX, pos.y + CELL_HEIGHT, boldRight);
      } else {
        const ljx = leftFeeder.x + CELL_WIDTH + (pos.x - (leftFeeder.x + CELL_WIDTH)) / 2;
        const leftMidY = leftFeeder.y + CELL_HEIGHT / 2;
        svgLine(leftFeeder.x + CELL_WIDTH, leftMidY, ljx, leftMidY, boldLeft);
        svgLine(ljx, leftMidY, ljx, midY, boldLeft);
        svgLine(ljx, midY, pos.x, midY, boldLeft);

        const rjx = rightFeeder.x - (rightFeeder.x - (pos.x + CHAMP_WIDTH)) / 2;
        const rightMidY = rightFeeder.y + CELL_HEIGHT / 2;
        svgLine(rightFeeder.x, rightMidY, rjx, rightMidY);
        svgLine(rjx, rightMidY, rjx, midY);
        svgLine(rjx, midY, pos.x + CHAMP_WIDTH, midY);
      }

    } else if (pos.isLeftHalf) {
      const jx = feederA.x + CELL_WIDTH + (pos.x - (feederA.x + CELL_WIDTH)) / 2;
      const boldAny = boldA || boldB;
      svgLine(feederA.x + CELL_WIDTH, feederAMidY, jx, feederAMidY, boldA);
      svgLine(feederB.x + CELL_WIDTH, feederBMidY, jx, feederBMidY, boldB);
      svgLine(jx, feederAMidY, jx, feederBMidY, boldAny);
      svgLine(jx, midY, pos.x, midY, boldAny);

    } else {
      const jx = feederA.x - (feederA.x - (pos.x + CELL_WIDTH)) / 2;
      const boldAny = boldA || boldB;
      svgLine(feederA.x, feederAMidY, jx, feederAMidY, boldA);
      svgLine(feederB.x, feederBMidY, jx, feederBMidY, boldB);
      svgLine(jx, feederAMidY, jx, feederBMidY, boldAny);
      svgLine(jx, midY, pos.x + CELL_WIDTH, midY, boldAny);
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

  // ── 8. Seed numbers (per-quadrant) ──
  if (bracket.showSeedNumbers) {
    for (let i = 0; i < size; i++) {
      const slotIndex = getSlotIndex(size, 0, i);
      const pos = posMap[slotIndex];
      if (!pos) continue;

      const seedEl = document.createElement('div');
      seedEl.className = 'seed-number';
      seedEl.textContent = '#' + getQuadrantSeedRank(size, i);
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
