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

// ── Staggered layout ────────────────────────────────────────────────────────

function layoutStaggered(bracket) {
  const { size } = bracket;
  const totalRounds = getTotalRounds(size);
  const positions = [];
  const posMap = {};

  const halfSize = size / 2;
  const roundsPerHalf = Math.log2(halfSize) + 1; // rounds 0..roundsPerHalf-1

  // Height: same as classic — driven by round-0 count
  const round0CountPerHalf = halfSize;
  const round0Height = round0CountPerHalf * CELL_HEIGHT + (round0CountPerHalf - 1) * CELL_GAP;
  const totalHeight = round0Height + TOP_PADDING * 2 + LABEL_MARGIN;

  // Width: each round adds CELL_WIDTH + STAGGER_GAP (much smaller than ROUND_GAP)
  // left half: roundsPerHalf columns, right half: roundsPerHalf columns, plus champion
  const CENTER_GAP = ROUND_GAP;
  const halfWidth = CELL_WIDTH + (roundsPerHalf - 1) * (CELL_WIDTH + STAGGER_GAP);
  const totalWidth = LEFT_PADDING + halfWidth + CENTER_GAP + CHAMP_WIDTH + CENTER_GAP + halfWidth + RIGHT_PADDING;

  // --- Round 0: LEFT half ---
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

  // --- Round 0: RIGHT half ---
  const rightEdgeX = totalWidth - RIGHT_PADDING - CELL_WIDTH;
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
        x = LEFT_PADDING + round * (CELL_WIDTH + STAGGER_GAP);
      } else {
        x = rightEdgeX - round * (CELL_WIDTH + STAGGER_GAP);
      }

      const pos = {
        slotIndex, round, indexInRound: idx,
        x, y, isLeftHalf: leftHalf, isChampion: false,
      };
      positions.push(pos);
      posMap[slotIndex] = pos;
    }
  }

  // --- Champion: centered between the two semi-final cells ---
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
