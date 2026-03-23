import { describe, it, expect } from 'vitest';
import {
  getLuminance,
  getContrastRatio,
  getAutoTextColor,
  escapeHtml,
  generateId,
  formatRelativeTime,
} from '../../js/utils.js';

describe('getLuminance', () => {
  it('returns ~1 for white', () => {
    expect(getLuminance('#ffffff')).toBeCloseTo(1, 2);
  });

  it('returns ~0 for black', () => {
    expect(getLuminance('#000000')).toBeCloseTo(0, 2);
  });
});

describe('getAutoTextColor', () => {
  it('returns dark text for white background', () => {
    expect(getAutoTextColor('#ffffff')).toBe('#1a1a1a');
  });

  it('returns light text for black background', () => {
    expect(getAutoTextColor('#000000')).toBe('#ffffff');
  });
});

describe('getContrastRatio', () => {
  it('returns ~21 for white on black', () => {
    expect(getContrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });
});

describe('escapeHtml', () => {
  it('escapes < and >', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });
});

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns unique values', () => {
    expect(generateId()).not.toBe(generateId());
  });
});

describe('formatRelativeTime', () => {
  it('formats 2 minutes ago with "min"', () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoMinAgo)).toContain('min');
  });
});
