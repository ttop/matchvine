import { generateId, getAutoTextColor } from './utils.js';

// ── State ────────────────────────────────────────────────────────────────

export const state = {
  bracket: null,
};

// ── Slot indexing math ────────────────────────────────────────────────────

/** How many slots are in a given round. */
export function getSlotsInRound(size, round) {
  return size >> round; // size / 2^round
}

/** Starting flat-array index for the first slot in a given round. */
export function getSlotOffset(size, round) {
  let offset = 0;
  for (let r = 0; r < round; r++) {
    offset += getSlotsInRound(size, r);
  }
  return offset;
}

/** Total number of rounds (including the 1-slot champion round). */
export function getTotalRounds(size) {
  return Math.log2(size) + 1;
}

/** Flat array index for a slot at a given round and position within that round. */
export function getSlotIndex(size, round, indexInRound) {
  return getSlotOffset(size, round) + indexInRound;
}

/**
 * Returns the two flat slot indices from the previous round that feed into
 * this slot.  Returns null for round 0 (no feeders).
 */
export function getMatchupPair(size, round, indexInRound) {
  if (round === 0) return null;
  const prevRound = round - 1;
  const feederA   = indexInRound * 2;
  const feederB   = indexInRound * 2 + 1;
  return [
    getSlotIndex(size, prevRound, feederA),
    getSlotIndex(size, prevRound, feederB),
  ];
}

/**
 * Returns the { round, index } of the next slot this one promotes into.
 * Returns null for the champion slot.
 */
export function getNextSlot(size, round, indexInRound) {
  const totalRounds = getTotalRounds(size);
  if (round >= totalRounds - 1) return null; // champion slot
  return {
    round: round + 1,
    index: Math.floor(indexInRound / 2),
  };
}

/**
 * Returns true if this slot is in the left half of the bracket.
 * For round 0: left half = first size/2 entries.
 * For later rounds: follows whatever round-0 slots feed into it.
 */
export function isLeftHalf(size, round, indexInRound) {
  if (round === 0) {
    return indexInRound < size / 2;
  }
  // Trace back to round 0
  let r   = round;
  let idx = indexInRound;
  while (r > 0) {
    idx = idx * 2; // left-most feeder path
    r--;
  }
  return idx < size / 2;
}

/** Flat index of the champion (final) slot. */
export function getChampionSlotIndex(size) {
  return 2 * size - 2;
}

// ── Factory functions ─────────────────────────────────────────────────────

export function createBracket(size, title) {
  const totalSlots = 2 * size - 1;
  const slots = [];

  for (let i = 0; i < totalSlots; i++) {
    // Determine which round this flat index belongs to
    let round = 0;
    let offset = 0;
    while (true) {
      const slotsInRound = getSlotsInRound(size, round);
      if (i < offset + slotsInRound) {
        break;
      }
      offset += slotsInRound;
      round++;
    }
    const indexInRound = i - getSlotOffset(size, round);
    slots.push({ round, index: indexInRound, cellId: null });
  }

  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: title || 'My Bracket',
    titleFont: 'sans-serif',
    size,
    backgroundColor: '#ffffff',
    showSeedNumbers: true,
    layoutMode: 'full',
    createdAt: now,
    updatedAt: now,
    cells: {},
    slots,
    zoomState: { focused: false, region: null },
  };
}

export function createCell(text, bgColor) {
  return {
    id: generateId(),
    text: text || '',
    textColor: getAutoTextColor(bgColor || '#ffffff'),
    bgColor: bgColor || '#ffffff',
    sourceSlot: null,
  };
}

// ── Tournament state helpers ──────────────────────────────────────────────

export function hasTournamentStarted(bracket) {
  const { size } = bracket;
  const totalRounds = getTotalRounds(size);
  for (let round = 1; round < totalRounds; round++) {
    const slotsInRound = getSlotsInRound(size, round);
    for (let idx = 0; idx < slotsInRound; idx++) {
      const slotIndex = getSlotIndex(size, round, idx);
      const slot = bracket.slots[slotIndex];
      if (slot && slot.cellId) return true;
    }
  }
  return false;
}
