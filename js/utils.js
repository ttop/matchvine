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
