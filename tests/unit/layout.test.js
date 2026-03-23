import { describe, it, expect } from 'vitest';
import { calculateLayout } from '../../js/layout.js';
import { CELL_WIDTH, CELL_HEIGHT, CELL_GAP, LEFT_PADDING, RIGHT_PADDING } from '../../js/constants.js';

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
