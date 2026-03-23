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

/**
 * Generates NCAA-style matchup positions within a sub-bracket of size n.
 * Returns an array where index = position, value = seed rank at that position.
 * E.g. size 4 → [1, 4, 3, 2] meaning position 0 gets seed 1, position 1 gets seed 4, etc.
 * This ensures 1 plays N, and top seeds don't meet until late rounds.
 */
function generateMatchupSeeds(n) {
  if (n === 1) return [1];
  if (n === 2) return [1, 2];
  const prev = generateMatchupSeeds(n / 2);
  const result = [];
  for (const seed of prev) {
    result.push(seed);
    result.push(n + 1 - seed);
  }
  return result;
}

/**
 * Returns the traditional bracket seeding order for round-0 slot indices,
 * using quadrant-based seeding (like NCAA March Madness).
 *
 * The bracket is divided into quadrants (4 for size >= 8, 2 halves for size 4).
 * Each quadrant has its own seedings 1..Q where Q = size / numQuadrants.
 * Seed 1 plays seed Q, seed 2 plays seed Q-1, etc. within each quadrant.
 *
 * Returns an array of round-0 slot indices in the order seeds should be placed.
 * For a 64-player bracket: first 4 entries are the seed-1 slots for each
 * quadrant, next 4 are the seed-2 slots, etc.
 */
export function getBracketSeedOrder(size) {
  if (size <= 2) {
    return [getSlotIndex(size, 0, 0), getSlotIndex(size, 0, 1)].slice(0, size);
  }

  const numQuadrants = size >= 8 ? 4 : 2;
  const quadrantSize = size / numQuadrants;

  const quadrantSeeds = generateMatchupSeeds(quadrantSize);

  // For each quadrant, build a map: seed rank → slot index
  const quadrantSlotForSeed = [];
  for (let q = 0; q < numQuadrants; q++) {
    const slotForSeed = new Array(quadrantSize + 1);
    for (let i = 0; i < quadrantSize; i++) {
      const roundZeroIndex = q * quadrantSize + i;
      slotForSeed[quadrantSeeds[i]] = getSlotIndex(size, 0, roundZeroIndex);
    }
    quadrantSlotForSeed.push(slotForSeed);
  }

  // Round-robin across quadrants for each seed rank
  const order = [];
  for (let r = 1; r <= quadrantSize; r++) {
    for (let q = 0; q < numQuadrants; q++) {
      order.push(quadrantSlotForSeed[q][r]);
    }
  }

  return order;
}

/**
 * Returns the per-quadrant seed rank (1-based) for a given round-0 index.
 * For a 64-bracket, each quadrant has seeds 1-16; this returns which seed
 * a given slot position holds within its quadrant.
 */
export function getQuadrantSeedRank(size, roundZeroIndex) {
  const numQuadrants = size >= 8 ? 4 : (size >= 4 ? 2 : 1);
  const quadrantSize = size / numQuadrants;
  const indexInQuadrant = roundZeroIndex % quadrantSize;
  const quadrantSeeds = generateMatchupSeeds(quadrantSize);
  return quadrantSeeds[indexInQuadrant];
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
    autoColor: true,
    layoutMode: 'staggered',
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
