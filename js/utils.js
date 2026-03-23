import { COLOR_PALETTE } from './constants.js';

/**
 * Pick a random color from COLOR_PALETTE, preferring unused colors.
 * @param {Set} usedColors - Colors already used in the bracket
 * @param {Array} excludeColors - Colors to never pick (e.g., matchup partner's color)
 * @returns {string} A hex color from COLOR_PALETTE
 */
export function getRandomColor(usedColors = new Set(), excludeColors = []) {
  const excludeSet = new Set(excludeColors);

  // First try: not used AND not excluded
  let candidates = COLOR_PALETTE.filter(c => !usedColors.has(c) && !excludeSet.has(c));

  // Fallback: allow used, but still exclude partner colors
  if (candidates.length === 0) {
    candidates = COLOR_PALETTE.filter(c => !excludeSet.has(c));
  }

  // Ultimate fallback: any color
  if (candidates.length === 0) {
    candidates = COLOR_PALETTE;
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** WCAG 2.1 relative luminance for a hex colour string. */
export function getLuminance(hexColor) {
  if (!hexColor || !/^#[0-9a-fA-F]{6}$/.test(hexColor)) return 0;
  const hex = hexColor.replace('#', '');
  const r   = parseInt(hex.substring(0, 2), 16) / 255;
  const g   = parseInt(hex.substring(2, 4), 16) / 255;
  const b   = parseInt(hex.substring(4, 6), 16) / 255;

  const toLinear = c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two hex colours. */
export function getContrastRatio(color1, color2) {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Choose dark or light text colour based on the background.
 * Uses dark text (#1a1a1a) when it achieves >= 4.5 contrast ratio,
 * otherwise falls back to white.
 */
export function getAutoTextColor(bgColor) {
  const darkText = '#1a1a1a';
  const lightText = '#ffffff';
  return getContrastRatio(bgColor, darkText) >= 4.5 ? darkText : lightText;
}

export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function generateId() {
  return Date.now() + '-' + Math.random().toString(36).slice(2, 11);
}

/**
 * Convert a bracket title into a URL-safe slug.
 * e.g. "Top Albums!" → "top-albums"
 */
export function slugify(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'untitled';
}

/**
 * Build a map from slug → bracket id, using the index metadata.
 * The oldest bracket (by createdAt) owns the bare slug; duplicates get -2, -3, etc.
 *
 * @param {Array<{id, title, createdAt}>} index
 * @returns {{ slugToId: Map<string,string>, idToSlug: Map<string,string> }}
 */
export function buildSlugMap(index) {
  // Group brackets by their base slug
  const groups = new Map();
  for (const entry of index) {
    const base = slugify(entry.title);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(entry);
  }

  const slugToId = new Map();
  const idToSlug = new Map();

  for (const [base, entries] of groups) {
    // Sort by createdAt ascending — oldest first owns the bare slug
    entries.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    entries.forEach((entry, i) => {
      const slug = i === 0 ? base : `${base}-${i + 1}`;
      slugToId.set(slug, entry.id);
      idToSlug.set(entry.id, slug);
    });
  }

  return { slugToId, idToSlug };
}

export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return diffSec + ' sec ago';
  if (diffMin < 60) return diffMin + ' min ago';
  if (diffHr < 24) return diffHr + ' hr ago';
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return diffDay + ' days ago';

  const d = new Date(isoString);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}
