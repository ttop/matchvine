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

describe('constants', () => {
  it('COLOR_PALETTE has 40 entries', () => {
    expect(COLOR_PALETTE).toHaveLength(40);
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
