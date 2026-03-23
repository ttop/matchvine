import { describe, it, expect } from 'vitest';
import {
  getLuminance,
  getContrastRatio,
  getAutoTextColor,
  escapeHtml,
  generateId,
  formatRelativeTime,
  slugify,
  buildSlugMap,
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

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Top Albums')).toBe('top-albums');
  });

  it('strips special characters', () => {
    expect(slugify('Best Movies!!!')).toBe('best-movies');
  });

  it('collapses multiple separators', () => {
    expect(slugify('a   b---c')).toBe('a-b-c');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  --hello--  ')).toBe('hello');
  });

  it('returns "untitled" for empty or whitespace-only input', () => {
    expect(slugify('')).toBe('untitled');
    expect(slugify('   ')).toBe('untitled');
    expect(slugify('!!!')).toBe('untitled');
  });

  it('handles null/undefined', () => {
    expect(slugify(null)).toBe('untitled');
    expect(slugify(undefined)).toBe('untitled');
  });
});

describe('buildSlugMap', () => {
  it('maps a single bracket to its slug', () => {
    const index = [{ id: 'a', title: 'Top Albums', createdAt: '2025-01-01' }];
    const { slugToId, idToSlug } = buildSlugMap(index);
    expect(slugToId.get('top-albums')).toBe('a');
    expect(idToSlug.get('a')).toBe('top-albums');
  });

  it('gives bare slug to oldest bracket with same title', () => {
    const index = [
      { id: 'newer', title: 'Top Albums', createdAt: '2025-06-01' },
      { id: 'older', title: 'Top Albums', createdAt: '2025-01-01' },
    ];
    const { slugToId, idToSlug } = buildSlugMap(index);
    expect(slugToId.get('top-albums')).toBe('older');
    expect(idToSlug.get('older')).toBe('top-albums');
    expect(slugToId.get('top-albums-2')).toBe('newer');
    expect(idToSlug.get('newer')).toBe('top-albums-2');
  });

  it('handles three brackets with the same slug', () => {
    const index = [
      { id: 'c', title: 'Test', createdAt: '2025-03-01' },
      { id: 'a', title: 'Test', createdAt: '2025-01-01' },
      { id: 'b', title: 'Test', createdAt: '2025-02-01' },
    ];
    const { slugToId, idToSlug } = buildSlugMap(index);
    expect(idToSlug.get('a')).toBe('test');
    expect(idToSlug.get('b')).toBe('test-2');
    expect(idToSlug.get('c')).toBe('test-3');
  });

  it('handles different titles independently', () => {
    const index = [
      { id: 'a', title: 'Foo', createdAt: '2025-01-01' },
      { id: 'b', title: 'Bar', createdAt: '2025-01-01' },
    ];
    const { slugToId } = buildSlugMap(index);
    expect(slugToId.get('foo')).toBe('a');
    expect(slugToId.get('bar')).toBe('b');
  });

  it('returns empty maps for empty index', () => {
    const { slugToId, idToSlug } = buildSlugMap([]);
    expect(slugToId.size).toBe(0);
    expect(idToSlug.size).toBe(0);
  });
});
