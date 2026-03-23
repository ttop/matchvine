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
  getQuadrantSeedRank,
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

  it('distributes seeds round-robin across 4 quadrants for size 64', () => {
    const order = getBracketSeedOrder(64);
    // First 4 entries should be the seed-1 slot for each of the 4 quadrants
    // Quadrant boundaries: Q1=0-15, Q2=16-31, Q3=32-47, Q4=48-63 (round-0 indices)
    const quadrantOf = (slotIndex) => Math.floor(slotIndex / 16);
    // Each group of 4 consecutive entries should hit all 4 quadrants
    const q1Seeds = new Set([quadrantOf(order[0]), quadrantOf(order[1]), quadrantOf(order[2]), quadrantOf(order[3])]);
    expect(q1Seeds.size).toBe(4); // all 4 quadrants represented
  });

  it('seed 1 plays seed Q within each quadrant (1 vs last)', () => {
    const size = 64;
    const order = getBracketSeedOrder(size);
    const quadrantSize = 16;
    // For Q1 (round-0 indices 0-15): seed 1 and seed 16 should be matchup partners
    // Collect Q1 slots from the order (every 4th starting at 0)
    const q1Slots = [];
    for (let i = 0; i < order.length; i += 4) q1Slots.push(order[i]);
    // q1Slots[0] = Q1 seed 1, q1Slots[15] = Q1 seed 16
    // They should be in the same matchup (adjacent slots, XOR 1)
    expect(q1Slots[0] ^ 1).toBe(q1Slots[q1Slots.length - 1]);
  });

  it('uses 2 halves for size 4', () => {
    const order = getBracketSeedOrder(4);
    expect(order.length).toBe(4);
    const unique = new Set(order);
    expect(unique.size).toBe(4);
  });
});

describe('getQuadrantSeedRank', () => {
  it('returns seeds 1-16 for each quadrant in a 64-bracket', () => {
    for (let q = 0; q < 4; q++) {
      const seeds = [];
      for (let i = 0; i < 16; i++) {
        seeds.push(getQuadrantSeedRank(64, q * 16 + i));
      }
      seeds.sort((a, b) => a - b);
      expect(seeds).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    }
  });

  it('seed 1 plays seed 16 (adjacent positions) in each quadrant', () => {
    // Position 0 in each quadrant should be seed 1, position 1 should be seed 16
    for (let q = 0; q < 4; q++) {
      expect(getQuadrantSeedRank(64, q * 16 + 0)).toBe(1);
      expect(getQuadrantSeedRank(64, q * 16 + 1)).toBe(16);
    }
  });

  it('returns seeds 1-4 for each quadrant in a 16-bracket', () => {
    for (let q = 0; q < 4; q++) {
      const seeds = [];
      for (let i = 0; i < 4; i++) {
        seeds.push(getQuadrantSeedRank(16, q * 4 + i));
      }
      seeds.sort((a, b) => a - b);
      expect(seeds).toEqual([1, 2, 3, 4]);
    }
  });
});
