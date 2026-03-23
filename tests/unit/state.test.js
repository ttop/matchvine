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
    expect(b.layoutMode).toBe('full');
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
