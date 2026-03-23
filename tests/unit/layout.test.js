import { describe, it, expect } from 'vitest';
import { calculateLayout } from '../../js/layout.js';
import { CELL_WIDTH, CELL_HEIGHT, CELL_GAP, LEFT_PADDING, RIGHT_PADDING } from '../../js/constants.js';
import { STAGGER_GAP } from '../../js/layout.js';

// ── Classic (full) layout mode ──────────────────────────────────────────────

describe('calculateLayout — classic (full) mode', () => {
  it('size=4 returns 7 positions (2*4-1)', () => {
    const result = calculateLayout({ size: 4, layoutMode: 'full' });
    expect(result.positions).toHaveLength(7);
  });

  it('size=8 returns 15 positions (2*8-1)', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'full' });
    expect(result.positions).toHaveLength(15);
  });

  it('size=16 returns 31 positions (2*16-1)', () => {
    const result = calculateLayout({ size: 16, layoutMode: 'full' });
    expect(result.positions).toHaveLength(31);
  });

  it('champion position has isChampion: true', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'full' });
    const champs = result.positions.filter(p => p.isChampion);
    expect(champs).toHaveLength(1);
    expect(champs[0].isChampion).toBe(true);
  });

  it('left half round-0 positions have isLeftHalf: true', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'full' });
    const leftR0 = result.positions.filter(p => p.round === 0 && p.isLeftHalf);
    expect(leftR0.length).toBe(4); // half of 8
    leftR0.forEach(p => expect(p.isLeftHalf).toBe(true));
  });

  it('right half round-0 positions have isLeftHalf: false', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'full' });
    const rightR0 = result.positions.filter(p => p.round === 0 && !p.isLeftHalf);
    expect(rightR0.length).toBe(4);
    rightR0.forEach(p => expect(p.isLeftHalf).toBe(false));
  });

  it('totalWidth and totalHeight are positive numbers', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'full' });
    expect(result.totalWidth).toBeGreaterThan(0);
    expect(result.totalHeight).toBeGreaterThan(0);
  });

  it('round 1 cells are vertically centered between their round-0 feeders', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'full' });
    const r0Left = result.positions
      .filter(p => p.round === 0 && p.isLeftHalf)
      .sort((a, b) => a.indexInRound - b.indexInRound);
    const r1Left = result.positions
      .filter(p => p.round === 1 && p.isLeftHalf)
      .sort((a, b) => a.indexInRound - b.indexInRound);

    // First round-1 cell should be midpoint of first two round-0 cells
    const expectedY = (r0Left[0].y + r0Left[1].y) / 2;
    expect(r1Left[0].y).toBeCloseTo(expectedY, 1);
  });

  it('right-half round-0 cells have larger x than left-half round-0 cells', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'full' });
    const leftR0 = result.positions.filter(p => p.round === 0 && p.isLeftHalf);
    const rightR0 = result.positions.filter(p => p.round === 0 && !p.isLeftHalf);
    const maxLeftX = Math.max(...leftR0.map(p => p.x));
    const minRightX = Math.min(...rightR0.map(p => p.x));
    expect(minRightX).toBeGreaterThan(maxLeftX);
  });

  it('posMap provides O(1) lookup by slotIndex', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'full' });
    result.positions.forEach(pos => {
      expect(result.posMap[pos.slotIndex]).toBe(pos);
    });
  });

  it('championX is a positive number', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'full' });
    expect(result.championX).toBeGreaterThan(0);
  });
});

// ── Staggered layout mode ───────────────────────────────────────────────────

describe('calculateLayout — staggered mode', () => {
  it('size=8 returns 15 positions (2*8-1)', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'staggered' });
    expect(result.positions).toHaveLength(15);
  });

  it('round 0 left-half cells are stacked vertically (same y spacing as classic)', () => {
    const staggered = calculateLayout({ size: 8, layoutMode: 'staggered' });
    const classic = calculateLayout({ size: 8, layoutMode: 'full' });

    const stR0 = staggered.positions
      .filter(p => p.round === 0 && p.isLeftHalf)
      .sort((a, b) => a.indexInRound - b.indexInRound);
    const clR0 = classic.positions
      .filter(p => p.round === 0 && p.isLeftHalf)
      .sort((a, b) => a.indexInRound - b.indexInRound);

    // Same y positions
    for (let i = 0; i < stR0.length; i++) {
      expect(stR0[i].y).toBeCloseTo(clR0[i].y, 1);
    }
  });

  it('round 1 left-half cells have x = round-0 x + CELL_WIDTH + STAGGER_GAP (~30px)', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'staggered' });
    const r0Left = result.positions.filter(p => p.round === 0 && p.isLeftHalf);
    const r1Left = result.positions.filter(p => p.round === 1 && p.isLeftHalf);

    const expectedX = r0Left[0].x + CELL_WIDTH + STAGGER_GAP;
    r1Left.forEach(p => expect(p.x).toBeCloseTo(expectedX, 1));
  });

  it('round 1 cells have y = midpoint of their two feeder cells', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'staggered' });
    const r0Left = result.positions
      .filter(p => p.round === 0 && p.isLeftHalf)
      .sort((a, b) => a.indexInRound - b.indexInRound);
    const r1Left = result.positions
      .filter(p => p.round === 1 && p.isLeftHalf)
      .sort((a, b) => a.indexInRound - b.indexInRound);

    const expectedY = (r0Left[0].y + r0Left[1].y) / 2;
    expect(r1Left[0].y).toBeCloseTo(expectedY, 1);
  });

  it('staggered totalWidth is LESS than classic totalWidth for same size', () => {
    const staggered = calculateLayout({ size: 8, layoutMode: 'staggered' });
    const classic = calculateLayout({ size: 8, layoutMode: 'full' });
    expect(staggered.totalWidth).toBeLessThan(classic.totalWidth);
  });

  it('champion is NOT at a staggered position — centered prominently', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'staggered' });
    const champ = result.positions.find(p => p.isChampion);
    expect(champ).toBeDefined();
    expect(champ.isChampion).toBe(true);
    // Champion x should be roughly centered
    expect(champ.x).toBeGreaterThan(result.totalWidth * 0.3);
    expect(champ.x).toBeLessThan(result.totalWidth * 0.7);
  });

  it('right half mirrors left half (round 0 on far right, advancing leftward)', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'staggered' });
    const r0Right = result.positions.filter(p => p.round === 0 && !p.isLeftHalf);
    const r1Right = result.positions.filter(p => p.round === 1 && !p.isLeftHalf);

    // Round 0 right should be at the far right
    const maxX = Math.max(...result.positions.filter(p => !p.isChampion).map(p => p.x));
    expect(r0Right[0].x).toBe(maxX);

    // Round 1 right should shift LEFT (smaller x than round 0)
    r1Right.forEach(p => expect(p.x).toBeLessThan(r0Right[0].x));
  });

  it('posMap provides O(1) lookup by slotIndex', () => {
    const result = calculateLayout({ size: 8, layoutMode: 'staggered' });
    result.positions.forEach(pos => {
      expect(result.posMap[pos.slotIndex]).toBe(pos);
    });
  });

  it('returns the same shape as classic mode', () => {
    const staggered = calculateLayout({ size: 8, layoutMode: 'staggered' });
    const classic = calculateLayout({ size: 8, layoutMode: 'full' });
    // Same keys
    expect(Object.keys(staggered).sort()).toEqual(Object.keys(classic).sort());
    // Same position shape
    const sKeys = Object.keys(staggered.positions[0]).sort();
    const cKeys = Object.keys(classic.positions[0]).sort();
    expect(sKeys).toEqual(cKeys);
  });
});
