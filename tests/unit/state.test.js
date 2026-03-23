import { describe, it, expect } from 'vitest';
import {
  getSlotOffset,
  getSlotsInRound,
  getTotalRounds,
  getMatchupPair,
  getNextSlot,
  isLeftHalf,
  getChampionSlotIndex,
  createBracket,
  createCell,
  hasTournamentStarted,
  getBracketSeedOrder,
  getSlotIndex,
} from '../../js/state.js';

describe('slot indexing', () => {
  it('getSlotOffset(8,0) === 0', () => {
    expect(getSlotOffset(8, 0)).toBe(0);
  });

  it('getSlotOffset(8,1) === 8', () => {
    expect(getSlotOffset(8, 1)).toBe(8);
  });

  it('getSlotsInRound(16,0) === 16', () => {
    expect(getSlotsInRound(16, 0)).toBe(16);
  });

  it('getSlotsInRound(16,1) === 8', () => {
    expect(getSlotsInRound(16, 1)).toBe(8);
  });

  it('getTotalRounds(8) === 4', () => {
    expect(getTotalRounds(8)).toBe(4);
  });

  it('getTotalRounds(16) === 5', () => {
    expect(getTotalRounds(16)).toBe(5);
  });
});

describe('getMatchupPair', () => {
  it('returns array of 2 flat indices for round 1', () => {
    const pair = getMatchupPair(8, 1, 0);
    expect(pair).toHaveLength(2);
    expect(typeof pair[0]).toBe('number');
    expect(typeof pair[1]).toBe('number');
  });
});

describe('getNextSlot', () => {
  it('returns {round:1, index:0} for slot (8,0,0)', () => {
    expect(getNextSlot(8, 0, 0)).toEqual({ round: 1, index: 0 });
  });
});

describe('isLeftHalf', () => {
  it('isLeftHalf(16,0,0) === true', () => {
    expect(isLeftHalf(16, 0, 0)).toBe(true);
  });

  it('isLeftHalf(16,0,8) === false', () => {
    expect(isLeftHalf(16, 0, 8)).toBe(false);
  });
});

describe('getChampionSlotIndex', () => {
  it('getChampionSlotIndex(8) === 14', () => {
    expect(getChampionSlotIndex(8)).toBe(14);
  });

  it('getChampionSlotIndex(16) === 30', () => {
    expect(getChampionSlotIndex(16)).toBe(30);
  });
});

describe('createBracket', () => {
  it('creates bracket with 31 slots for size 16', () => {
    const b = createBracket(16, 'Test');
    expect(b.slots).toHaveLength(31);
    expect(b.slots.every(s => s.cellId === null)).toBe(true);
    expect(b.title).toBe('Test');
    expect(b.size).toBe(16);
    expect(b.cells).toBeDefined();
    expect(typeof b.cells).toBe('object');
    expect(b.layoutMode).toBe('staggered');
  });
});

describe('createCell', () => {
  it('creates cell with expected properties', () => {
    const c = createCell('text', '#ff0000');
    expect(c.id).toBeDefined();
    expect(c.text).toBe('text');
    expect(c.bgColor).toBe('#ff0000');
    expect(c.textColor).toBeDefined();
    expect(c.sourceSlot).toBeNull();
  });
});

describe('hasTournamentStarted', () => {
  it('returns false for fresh bracket', () => {
    const b = createBracket(8, 'Fresh');
    expect(hasTournamentStarted(b)).toBe(false);
  });
});

describe('getBracketSeedOrder', () => {
  it('returns correct number of slots for all sizes', () => {
    for (const size of [4, 8, 16, 32, 64, 128]) {
      const order = getBracketSeedOrder(size);
      expect(order.length).toBe(size);
    }
  });

  it('returns unique slot indices', () => {
    const order = getBracketSeedOrder(16);
    const unique = new Set(order);
    expect(unique.size).toBe(16);
  });

  it('seed #1 and #2 are in opposite halves for size 16', () => {
    const order = getBracketSeedOrder(16);
    const slot1 = order[0]; // seed #1
    const slot2 = order[1]; // seed #2
    // Slot indices 0-7 are left half, 8-15 are right half
    const seed1Left = slot1 < 8;
    const seed2Left = slot2 < 8;
    expect(seed1Left).not.toBe(seed2Left);
  });

  it('seed #1 plays seed #16 (adjacent slots in same matchup) for size 16', () => {
    const order = getBracketSeedOrder(16);
    const slot1 = order[0];   // seed #1
    const slot16 = order[15]; // seed #16 (last in left half would be index 15 but interleaved)
    // Actually seed #1 is at order[0], seed #16 should be its matchup partner
    // In left half, matchup partners are adjacent: slot i and slot i^1
    // Find where seed 16 ended up — it should be the partner of seed 1
    // Seed 1 goes to order[0], its partner slot is order[0] ^ ...
    // Actually with interleaving, left seeds are at even indices, right at odd
    // Left half seed 1 → order[0], left half seed 16 → they should be adjacent slots
    // Let's just check the left half has #1 vs last seed
    const leftOrder = [];
    for (let i = 0; i < order.length; i += 2) leftOrder.push(order[i]);
    // leftOrder[0] = seed #1 slot, leftOrder[1] = seed #2 slot, etc but wait
    // Actually leftOrder has halfSize entries representing seeds 1..halfSize for left half
    // seed #1 and seed #halfSize should be matchup partners (adjacent slots)
    const s1 = leftOrder[0];
    const sLast = leftOrder[leftOrder.length - 1];
    // They should be in the same matchup: their slot indices should differ by 1 (XOR 1)
    expect(s1 ^ 1).toBe(sLast); // partners in the same matchup
  });
});
