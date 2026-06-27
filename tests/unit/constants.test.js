import { describe, it, expect } from 'vitest';
import {
  BRACKET_SIZES,
  COLOR_PALETTE,
  TEXT_COLORS,
  DEFAULT_FONTS,
  GOOGLE_FONTS,
  CELL_WIDTH,
  CELL_HEIGHT,
  CHAMP_WIDTH,
} from '../../js/constants.js';
import { getAutoTextColor, getContrastRatio } from '../../js/utils.js';

describe('constants', () => {
  it('COLOR_PALETTE has 48 entries', () => {
    expect(COLOR_PALETTE).toHaveLength(48);
  });

  it('every palette color is a valid 6-digit hex', () => {
    for (const color of COLOR_PALETTE) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('includes pure black', () => {
    expect(COLOR_PALETTE).toContain('#000000');
  });

  it('every palette color clears WCAG AA (4.5) with its auto text color', () => {
    for (const bg of COLOR_PALETTE) {
      const ratio = getContrastRatio(bg, getAutoTextColor(bg));
      expect(ratio, `contrast too low for ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('BRACKET_SIZES is [4,8,16,32,64,128]', () => {
    expect(BRACKET_SIZES).toEqual([4, 8, 16, 32, 64, 128]);
  });

  it('CELL_WIDTH, CELL_HEIGHT, CHAMP_WIDTH are numbers', () => {
    expect(typeof CELL_WIDTH).toBe('number');
    expect(typeof CELL_HEIGHT).toBe('number');
    expect(typeof CHAMP_WIDTH).toBe('number');
  });

  it('TEXT_COLORS has entries', () => {
    expect(TEXT_COLORS.length).toBeGreaterThan(0);
  });

  it('DEFAULT_FONTS has 4 entries', () => {
    expect(DEFAULT_FONTS).toHaveLength(4);
  });

  it('GOOGLE_FONTS has 8 entries', () => {
    expect(GOOGLE_FONTS).toHaveLength(8);
  });
});
