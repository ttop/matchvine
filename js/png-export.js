import { calculateLayout } from './layout.js';
import {
  CELL_WIDTH, CELL_HEIGHT, CHAMP_WIDTH, ROUND_GAP,
  LEFT_PADDING, RIGHT_PADDING,
} from './constants.js';
import {
  getSlotsInRound, getSlotIndex, getTotalRounds,
  getMatchupPair, getNextSlot, isLeftHalf,
} from './state.js';

// ── renderBracketToCanvas (private) ──────────────────────────────────────

function renderBracketToCanvas(bracket) {
  const layout = calculateLayout(bracket);
  const { positions, posMap, totalWidth, totalHeight } = layout;
  const { size } = bracket;
  const totalRounds = getTotalRounds(size);
  const halfSize = size / 2;
  const roundsPerHalf = Math.log2(halfSize) + 1;

  const SCALE = 2;
  const PADDING = 40;
  const TITLE_HEIGHT = 50;
  const canvasWidth = totalWidth + PADDING * 2;
  const canvasHeight = totalHeight + PADDING * 2 + TITLE_HEIGHT;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * SCALE;
  canvas.height = canvasHeight * SCALE;
  canvas.style.width = canvasWidth + 'px';
  canvas.style.height = canvasHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // Background
  ctx.fillStyle = bracket.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const ox = PADDING;
  const oy = PADDING + TITLE_HEIGHT;

  // Title
  const fontFamily = bracket.titleFont || 'sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111827';
  ctx.font = `600 36px "${fontFamily}", sans-serif`;
  ctx.fillText(bracket.title || 'Untitled Bracket', canvasWidth / 2, PADDING + TITLE_HEIGHT / 2 - 5);

  // Collect promoted cell IDs for winner/loser styling
  const promotedCellIds = new Set();
  for (let round = 1; round < totalRounds; round++) {
    const slotsInRound = getSlotsInRound(size, round);
    for (let idx = 0; idx < slotsInRound; idx++) {
      const slotIndex = getSlotIndex(size, round, idx);
      const slot = bracket.slots[slotIndex];
      if (slot && slot.cellId) promotedCellIds.add(slot.cellId);
    }
  }

  // Helper: draw rounded rect
  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Helper: draw a line segment on the canvas
  function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Draw connector lines
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1.5;

  const isStaggered = bracket.layoutMode === 'staggered';

  for (const pos of positions) {
    if (pos.round === 0) continue;
    const feeders = getMatchupPair(size, pos.round, pos.indexInRound);
    if (!feeders) continue;
    const feederA = posMap[feeders[0]];
    const feederB = posMap[feeders[1]];
    if (!feederA || !feederB) continue;

    const cellWidth = pos.isChampion ? CHAMP_WIDTH : CELL_WIDTH;
    const midY = oy + pos.y + CELL_HEIGHT / 2;
    const feederAMidY = oy + feederA.y + CELL_HEIGHT / 2;
    const feederBMidY = oy + feederB.y + CELL_HEIGHT / 2;

    if (isStaggered && !pos.isChampion) {
      // Staggered lines: horizontal from feeder edge to winner midX, then vertical to winner edge
      const winnerMidX = ox + pos.x + CELL_WIDTH / 2;

      if (pos.isLeftHalf) {
        // Top feeder: horizontal right to winnerMidX, then vertical down to winner top
        drawLine(ox + feederA.x + CELL_WIDTH, feederAMidY, winnerMidX, feederAMidY);
        drawLine(winnerMidX, feederAMidY, winnerMidX, oy + pos.y);
        // Bottom feeder: horizontal right to winnerMidX, then vertical up to winner bottom
        drawLine(ox + feederB.x + CELL_WIDTH, feederBMidY, winnerMidX, feederBMidY);
        drawLine(winnerMidX, feederBMidY, winnerMidX, oy + pos.y + CELL_HEIGHT);
      } else {
        // Right half: horizontal left to winnerMidX, then vertical
        drawLine(ox + feederA.x, feederAMidY, winnerMidX, feederAMidY);
        drawLine(winnerMidX, feederAMidY, winnerMidX, oy + pos.y);
        drawLine(ox + feederB.x, feederBMidY, winnerMidX, feederBMidY);
        drawLine(winnerMidX, feederBMidY, winnerMidX, oy + pos.y + CELL_HEIGHT);
      }

    } else if (pos.isChampion) {
      const leftFeeder = feederA.isLeftHalf ? feederA : feederB;
      const rightFeeder = feederA.isLeftHalf ? feederB : feederA;
      const champMidX = ox + pos.x + CHAMP_WIDTH / 2;

      if (isStaggered) {
        // Staggered: lines from semis go horizontal then vertical to champion's top/bottom at its horizontal midpoint
        const leftMidY = oy + leftFeeder.y + CELL_HEIGHT / 2;
        const rightMidY = oy + rightFeeder.y + CELL_HEIGHT / 2;
        // Left semi -> champion top edge at midpoint
        drawLine(ox + leftFeeder.x + CELL_WIDTH, leftMidY, champMidX, leftMidY);
        drawLine(champMidX, leftMidY, champMidX, oy + pos.y);
        // Right semi -> champion bottom edge at midpoint
        drawLine(ox + rightFeeder.x, rightMidY, champMidX, rightMidY);
        drawLine(champMidX, rightMidY, champMidX, oy + pos.y + CELL_HEIGHT);
      } else {
        // Classic: horizontal bracket lines to champion left/right edges
        const ljx = ox + leftFeeder.x + CELL_WIDTH + (pos.x - (leftFeeder.x + CELL_WIDTH)) / 2;
        const leftMidY = oy + leftFeeder.y + CELL_HEIGHT / 2;
        ctx.beginPath();
        ctx.moveTo(ox + leftFeeder.x + CELL_WIDTH, leftMidY);
        ctx.lineTo(ljx, leftMidY);
        ctx.lineTo(ljx, midY);
        ctx.lineTo(ox + pos.x, midY);
        ctx.stroke();

        const rjx = ox + rightFeeder.x - (rightFeeder.x - (pos.x + CHAMP_WIDTH)) / 2;
        const rightMidY = oy + rightFeeder.y + CELL_HEIGHT / 2;
        ctx.beginPath();
        ctx.moveTo(ox + rightFeeder.x, rightMidY);
        ctx.lineTo(rjx, rightMidY);
        ctx.lineTo(rjx, midY);
        ctx.lineTo(ox + pos.x + CHAMP_WIDTH, midY);
        ctx.stroke();
      }

    } else if (pos.isLeftHalf) {
      const jx = ox + feederA.x + CELL_WIDTH + (pos.x - (feederA.x + CELL_WIDTH)) / 2;
      ctx.beginPath();
      ctx.moveTo(ox + feederA.x + CELL_WIDTH, feederAMidY);
      ctx.lineTo(jx, feederAMidY);
      ctx.moveTo(ox + feederB.x + CELL_WIDTH, feederBMidY);
      ctx.lineTo(jx, feederBMidY);
      ctx.moveTo(jx, feederAMidY);
      ctx.lineTo(jx, feederBMidY);
      ctx.moveTo(jx, midY);
      ctx.lineTo(ox + pos.x, midY);
      ctx.stroke();

    } else {
      const jx = ox + feederA.x - (feederA.x - (pos.x + CELL_WIDTH)) / 2;
      ctx.beginPath();
      ctx.moveTo(ox + feederA.x, feederAMidY);
      ctx.lineTo(jx, feederAMidY);
      ctx.moveTo(ox + feederB.x, feederBMidY);
      ctx.lineTo(jx, feederBMidY);
      ctx.moveTo(jx, feederAMidY);
      ctx.lineTo(jx, feederBMidY);
      ctx.moveTo(jx, midY);
      ctx.lineTo(ox + pos.x + CELL_WIDTH, midY);
      ctx.stroke();
    }
  }

  // Draw cells
  for (const pos of positions) {
    const slot = bracket.slots[pos.slotIndex];
    const isChamp = pos.isChampion;
    const cellWidth = isChamp ? CHAMP_WIDTH : CELL_WIDTH;
    const cx = ox + pos.x;
    const cy = oy + pos.y;

    let bgColor = '#f3f4f6';
    let textColor = '#9ca3af';
    let borderColor = '#d1d5db';
    let borderWidth = 1.5;
    let text = '?';
    let isLoser = false;

    if (slot && slot.cellId && bracket.cells[slot.cellId]) {
      const cell = bracket.cells[slot.cellId];
      bgColor = cell.bgColor || '#ffffff';
      textColor = cell.textColor || '#1a1a1a';
      text = cell.text || '';

      // Winner/loser
      if (pos.round < totalRounds - 1 && promotedCellIds.has(slot.cellId)) {
        const next = getNextSlot(size, pos.round, pos.indexInRound);
        if (next) {
          const nextSlotIndex = getSlotIndex(size, next.round, next.index);
          const nextSlot = bracket.slots[nextSlotIndex];
          if (nextSlot && nextSlot.cellId === slot.cellId) {
            borderColor = '#22c55e';
            borderWidth = 2;
          } else if (nextSlot && nextSlot.cellId && nextSlot.cellId !== slot.cellId) {
            isLoser = true;
          }
        }
      }
    }

    if (isChamp) {
      borderColor = '#f59e0b';
      borderWidth = 2.5;
    }

    // Draw rounded rect
    ctx.globalAlpha = isLoser ? 0.5 : 1;
    roundedRect(cx, cy, cellWidth, CELL_HEIGHT, 8);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();

    // Draw text
    ctx.fillStyle = textColor;
    const isFilled = slot && slot.cellId && bracket.cells[slot.cellId];
    const displayText = isChamp && isFilled && text ? '\u{1F3C6} ' + text : (isChamp ? '\u{1F3C6}' : text);
    let fontSize = 14;
    ctx.font = `500 ${fontSize}px "${fontFamily}", sans-serif`;
    while (fontSize > 9 && ctx.measureText(displayText).width > cellWidth - 16) {
      fontSize--;
      ctx.font = `500 ${fontSize}px "${fontFamily}", sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, cx + cellWidth / 2, cy + CELL_HEIGHT / 2, cellWidth - 8);

    ctx.globalAlpha = 1;
  }

  // Round labels — use same getHalfRoundLabel as render.js
  function getHalfRoundLabel(round, roundsInHalf) {
    if (round === roundsInHalf - 1) return 'Finals';
    if (round === roundsInHalf - 2) return 'Semifinals';
    if (round === roundsInHalf - 3) return 'Quarterfinals';
    return 'Round ' + (round + 1);
  }

  const labelY = oy + totalHeight - 30;
  ctx.fillStyle = '#9ca3af';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Position labels based on actual cell positions (works for both classic and staggered)
  for (let r = 0; r < roundsPerHalf; r++) {
    const leftCell = positions.find(p => p.round === r && p.isLeftHalf);
    if (leftCell) {
      ctx.fillText(getHalfRoundLabel(r, roundsPerHalf), ox + leftCell.x + CELL_WIDTH / 2, labelY);
    }

    const rightCell = positions.find(p => p.round === r && !p.isLeftHalf && !p.isChampion);
    if (rightCell) {
      ctx.fillText(getHalfRoundLabel(r, roundsPerHalf), ox + rightCell.x + CELL_WIDTH / 2, labelY);
    }
  }
  // Champion label
  ctx.fillText('Champion', ox + layout.championX + CHAMP_WIDTH / 2, labelY);

  // Seed numbers
  if (bracket.showSeedNumbers) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    for (let i = 0; i < size; i++) {
      const slotIndex = getSlotIndex(size, 0, i);
      const pos = posMap[slotIndex];
      if (!pos) continue;
      const label = '#' + (i + 1);
      if (pos.isLeftHalf) {
        ctx.textAlign = 'right';
        ctx.fillText(label, ox + pos.x - 4, oy + pos.y + CELL_HEIGHT / 2);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(label, ox + pos.x + CELL_WIDTH + 4, oy + pos.y + CELL_HEIGHT / 2);
      }
    }
  }

  return canvas;
}

// ── exportPNG ────────────────────────────────────────────────────────────

function sanitizeFilename(title) {
  return (title || 'bracket').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').substring(0, 60) || 'bracket';
}

/**
 * Render the bracket to a canvas and trigger a PNG download.
 *
 * @param {object} bracket - The bracket data object
 * @param {object} [deps] - Optional dependencies: { loadGoogleFont, isGoogleFont }
 */
export async function exportPNG(bracket, deps) {
  if (!bracket) return;

  const fontFamily = bracket.titleFont || 'sans-serif';
  if (deps && deps.isGoogleFont && deps.isGoogleFont(fontFamily)) {
    await deps.loadGoogleFont(fontFamily);
  }
  try {
    await document.fonts.load(`500 14px "${fontFamily}"`);
  } catch (e) {}

  const canvas = renderBracketToCanvas(bracket);
  canvas.toBlob(function(blob) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(bracket.title) + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
