import {
  CELL_WIDTH, CELL_HEIGHT, ROUND_GAP, CELL_GAP,
  CHAMP_WIDTH, TOP_PADDING, LABEL_MARGIN,
  LEFT_PADDING, RIGHT_PADDING,
} from './constants.js';

import {
  getSlotsInRound, getSlotIndex, getTotalRounds,
  getMatchupPair, isLeftHalf, getChampionSlotIndex,
} from './state.js';

export const STAGGER_GAP = 30;

/**
 * Calculate layout positions for every slot in the bracket.
 * Returns { positions, posMap, totalWidth, totalHeight, championX }.
 */
export function calculateLayout(bracket) {
  const { layoutMode } = bracket;
  if (layoutMode === 'staggered') {
    return layoutStaggered(bracket);
  }
  return layoutFull(bracket);
}

// ── Classic (full) layout ───────────────────────────────────────────────────

function layoutFull(bracket) {
  const { size } = bracket;
  const totalRounds = getTotalRounds(size);
  const positions = [];
  const posMap = {};

  const halfSize = size / 2;
  const roundsPerHalf = Math.log2(halfSize) + 1;

  // Height of round-0 column in one half
  const round0CountPerHalf = halfSize;
  const round0Height = round0CountPerHalf * CELL_HEIGHT + (round0CountPerHalf - 1) * CELL_GAP;

  const totalHeight = round0Height + TOP_PADDING * 2 + LABEL_MARGIN;

  // Total width: left half columns + gap + champion + gap + right half columns
  const leftCols = roundsPerHalf;
  const rightCols = roundsPerHalf;
  const CENTER_GAP = ROUND_GAP;
  const totalWidth = LEFT_PADDING + leftCols * (CELL_WIDTH + ROUND_GAP) - ROUND_GAP
    + CENTER_GAP + CHAMP_WIDTH + CENTER_GAP
    + rightCols * (CELL_WIDTH + ROUND_GAP) - ROUND_GAP + RIGHT_PADDING;

  const championX = LEFT_PADDING + leftCols * (CELL_WIDTH + ROUND_GAP) - ROUND_GAP + CENTER_GAP;

  // --- Round 0: LEFT half (indices 0..halfSize-1) ---
  for (let i = 0; i < halfSize; i++) {
    const slotIndex = getSlotIndex(size, 0, i);
    const y = TOP_PADDING + i * (CELL_HEIGHT + CELL_GAP);
    const x = LEFT_PADDING;
    const pos = {
      slotIndex, round: 0, indexInRound: i,
      x, y, isLeftHalf: true, isChampion: false,
    };
    positions.push(pos);
    posMap[slotIndex] = pos;
  }

  // --- Round 0: RIGHT half (indices halfSize..size-1) ---
  const rightEdgeX = totalWidth - CELL_WIDTH - RIGHT_PADDING;
  for (let i = halfSize; i < size; i++) {
    const slotIndex = getSlotIndex(size, 0, i);
    const y = TOP_PADDING + (i - halfSize) * (CELL_HEIGHT + CELL_GAP);
    const x = rightEdgeX;
    const pos = {
      slotIndex, round: 0, indexInRound: i,
      x, y, isLeftHalf: false, isChampion: false,
    };
    positions.push(pos);
    posMap[slotIndex] = pos;
  }

  // --- Rounds 1+ (not champion) ---
  for (let round = 1; round < totalRounds - 1; round++) {
    const slotsInRound = getSlotsInRound(size, round);
    for (let idx = 0; idx < slotsInRound; idx++) {
      const slotIndex = getSlotIndex(size, round, idx);
      const leftHalf = isLeftHalf(size, round, idx);
      const feeders = getMatchupPair(size, round, idx);
      const feederA = posMap[feeders[0]];
      const feederB = posMap[feeders[1]];
      const y = (feederA.y + feederB.y) / 2;

      let x;
      if (leftHalf) {
        x = LEFT_PADDING + round * (CELL_WIDTH + ROUND_GAP);
      } else {
        x = rightEdgeX - round * (CELL_WIDTH + ROUND_GAP);
      }

      const pos = {
        slotIndex, round, indexInRound: idx,
        x, y, isLeftHalf: leftHalf, isChampion: false,
      };
      positions.push(pos);
      posMap[slotIndex] = pos;
    }
  }

  // --- Champion slot ---
  {
    const champRound = totalRounds - 1;
    const slotIndex = getChampionSlotIndex(size);
    const feeders = getMatchupPair(size, champRound, 0);
    const feederA = posMap[feeders[0]];
    const feederB = posMap[feeders[1]];
    const y = (feederA.y + feederB.y) / 2;
    const pos = {
      slotIndex, round: champRound, indexInRound: 0,
      x: championX, y, isLeftHalf: false, isChampion: true,
    };
    positions.push(pos);
    posMap[slotIndex] = pos;
  }

  return { positions, posMap, totalWidth, totalHeight, championX };
}

// ── Staggered (nested/waterfall) layout ──────────────────────────────────────
//
// In staggered mode, next-round cells NEST between their feeders vertically.
// Cell c (winner of a vs b) sits below a and above b, shifted right.
// This is much more compact than columnar layout.
//
// Visual (left half, 4 cells → 2 → 1):
//   [a]
//      [c] ──┐
//   [b]      │
//            [g]
//   [d]      │
//      [f] ──┘
//   [e]

function layoutStaggered(bracket) {
  const { size } = bracket;
  const totalRounds = getTotalRounds(size);
  const positions = [];
  const posMap = {};

  const halfSize = size / 2;
  const roundsPerHalf = Math.log2(halfSize) + 1;

  // Vertical spacing: each round-0 pair needs enough space for the nested cell between them.
  // For a pair (a, b), cell c sits between them. We need:
  //   a.y + CELL_HEIGHT + NEST_GAP <= c.y
  //   c.y + CELL_HEIGHT + NEST_GAP <= b.y
  // So the spacing between a and b is: 2 * CELL_HEIGHT + 2 * NEST_GAP
  // But pairs also need spacing between them (between b of one pair and a of next pair).
  const NEST_GAP = CELL_HEIGHT + 28;  // vertical space between feeders — room for winner cell + breathing room
  const PAIR_GAP = 32; // vertical gap between pairs

  // Calculate round-0 y positions for left half.
  // Each pair of cells takes: CELL_HEIGHT + NEST_GAP + CELL_HEIGHT = 2*CH + NG
  // Between pairs: PAIR_GAP
  // For halfSize cells (halfSize/2 pairs):
  const numPairs = halfSize / 2;
  const pairHeight = 2 * CELL_HEIGHT + NEST_GAP;
  const round0Height = numPairs * pairHeight + (numPairs - 1) * PAIR_GAP;
  const totalHeight = round0Height + TOP_PADDING * 2 + LABEL_MARGIN;

  // Horizontal offset: ~75% of cell width — nestled but not too tight
  const STAGGER_X = Math.floor(CELL_WIDTH * 0.75);

  // Total width for one half: round 0 starts at left, each subsequent round shifts right by STAGGER_X
  const halfWidth = CELL_WIDTH + (roundsPerHalf - 1) * STAGGER_X;
  const CENTER_GAP = ROUND_GAP;
  const totalWidth = LEFT_PADDING + halfWidth + CENTER_GAP + CHAMP_WIDTH + CENTER_GAP + halfWidth + RIGHT_PADDING;

  // --- Round 0: LEFT half ---
  // Place in pairs: (0,1), (2,3), (4,5), ...
  // Within a pair, first cell at top, second cell at bottom (with space for nested winner)
  for (let i = 0; i < halfSize; i++) {
    const slotIndex = getSlotIndex(size, 0, i);
    const pairIdx = Math.floor(i / 2);
    const isSecondInPair = i % 2 === 1;
    const pairTop = TOP_PADDING + pairIdx * (pairHeight + PAIR_GAP);
    const y = isSecondInPair ? pairTop + CELL_HEIGHT + NEST_GAP : pairTop;
    const x = LEFT_PADDING;
    const pos = {
      slotIndex, round: 0, indexInRound: i,
      x, y, isLeftHalf: true, isChampion: false,
    };
    positions.push(pos);
    posMap[slotIndex] = pos;
  }

  // --- Round 0: RIGHT half ---
  const rightEdgeX = totalWidth - RIGHT_PADDING - CELL_WIDTH;
  for (let i = halfSize; i < size; i++) {
    const slotIndex = getSlotIndex(size, 0, i);
    const localIdx = i - halfSize;
    const pairIdx = Math.floor(localIdx / 2);
    const isSecondInPair = localIdx % 2 === 1;
    const pairTop = TOP_PADDING + pairIdx * (pairHeight + PAIR_GAP);
    const y = isSecondInPair ? pairTop + CELL_HEIGHT + NEST_GAP : pairTop;
    const x = rightEdgeX;
    const pos = {
      slotIndex, round: 0, indexInRound: i,
      x, y, isLeftHalf: false, isChampion: false,
    };
    positions.push(pos);
    posMap[slotIndex] = pos;
  }

  // --- Rounds 1+ (not champion): nest between feeders ---
  for (let round = 1; round < totalRounds - 1; round++) {
    const slotsInRound = getSlotsInRound(size, round);
    for (let idx = 0; idx < slotsInRound; idx++) {
      const slotIndex = getSlotIndex(size, round, idx);
      const leftHalf = isLeftHalf(size, round, idx);
      const feeders = getMatchupPair(size, round, idx);
      const feederA = posMap[feeders[0]]; // top feeder
      const feederB = posMap[feeders[1]]; // bottom feeder

      const isSemis = round === roundsPerHalf - 1;

      let y;
      if (isSemis) {
        // Semis stay between their two Round 3 feeders, but shifted toward champion.
        // Left semi: just above the bottom feeder (between feeders, closer to center)
        // Right semi: just below the top feeder (between feeders, closer to center)
        if (leftHalf) {
          y = feederB.y - CELL_HEIGHT; // bottom edge aligns with bottom feeder's top edge
        } else {
          y = feederA.y + CELL_HEIGHT; // top edge aligns with top feeder's bottom edge
        }
      } else {
        // Normal rounds: nest centered between feeders
        const gapTop = feederA.y + CELL_HEIGHT;
        const gapBottom = feederB.y;
        y = gapTop + (gapBottom - gapTop - CELL_HEIGHT) / 2;
      }

      let x;
      if (leftHalf) {
        x = LEFT_PADDING + round * STAGGER_X;
      } else {
        x = rightEdgeX - round * STAGGER_X;
      }

      const pos = {
        slotIndex, round, indexInRound: idx,
        x, y, isLeftHalf: leftHalf, isChampion: false,
      };
      positions.push(pos);
      posMap[slotIndex] = pos;
    }
  }

  // --- Champion: centered, prominent ---
  {
    const champRound = totalRounds - 1;
    const slotIndex = getChampionSlotIndex(size);
    const feeders = getMatchupPair(size, champRound, 0);
    const feederA = posMap[feeders[0]];
    const feederB = posMap[feeders[1]];
    const y = (feederA.y + feederB.y) / 2;
    const championX = LEFT_PADDING + halfWidth + CENTER_GAP;
    const pos = {
      slotIndex, round: champRound, indexInRound: 0,
      x: championX, y, isLeftHalf: false, isChampion: true,
    };
    positions.push(pos);
    posMap[slotIndex] = pos;
  }

  const championX = LEFT_PADDING + halfWidth + CENTER_GAP;
  return { positions, posMap, totalWidth, totalHeight, championX };
}
