import { BRACKET_SIZES } from './constants.js';
import { state } from './state.js';
import { generateId } from './utils.js';

const STORAGE_INDEX_KEY = 'matchvine_index';
const STORAGE_BRACKET_PREFIX = 'matchvine_bracket_';

// ── saveBracket ──────────────────────────────────────────────────────────

export function saveBracket(bracket) {
  if (!bracket) return;
  bracket.updatedAt = new Date().toISOString();
  const key = STORAGE_BRACKET_PREFIX + bracket.id;
  try {
    localStorage.setItem(key, JSON.stringify(bracket));
  } catch (e) {
    console.warn('Failed to save bracket to localStorage', e);
  }
  // Update index
  let index = loadBracketIndex();
  const existing = index.findIndex(entry => entry.id === bracket.id);
  const meta = { id: bracket.id, title: bracket.title, size: bracket.size, updatedAt: bracket.updatedAt };
  if (existing >= 0) {
    index[existing] = meta;
  } else {
    index.push(meta);
  }
  try {
    localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn('Failed to save bracket index', e);
  }
}

// ── loadBracketIndex ─────────────────────────────────────────────────────

export function loadBracketIndex() {
  try {
    const raw = localStorage.getItem(STORAGE_INDEX_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

// ── loadBracket ──────────────────────────────────────────────────────────

export function loadBracket(id) {
  try {
    const raw = localStorage.getItem(STORAGE_BRACKET_PREFIX + id);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

// ── deleteBracketFromStorage ─────────────────────────────────────────────

export function deleteBracketFromStorage(id) {
  try {
    localStorage.removeItem(STORAGE_BRACKET_PREFIX + id);
  } catch (e) {}
  let index = loadBracketIndex();
  index = index.filter(entry => entry.id !== id);
  try {
    localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
  } catch (e) {}
}

// ── File export (.bracket) ───────────────────────────────────────────────

function sanitizeFilename(title) {
  return (title || 'bracket').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').substring(0, 60) || 'bracket';
}

export function downloadBracketFile(bracket) {
  if (!bracket) return;
  const json = JSON.stringify(bracket, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(bracket.title) + '.bracket';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── File import (.bracket) ───────────────────────────────────────────────

export function handleBracketFileLoad(file, callback) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      // Validate required fields
      if (!data.id || !data.size || !data.slots || !data.cells) {
        alert('Invalid bracket file: missing required fields.');
        return;
      }
      if (!BRACKET_SIZES.includes(data.size)) {
        alert('Invalid bracket size: ' + data.size);
        return;
      }
      // Give it a new ID to avoid collisions
      data.id = generateId();
      data.updatedAt = new Date().toISOString();
      callback(data);
    } catch (err) {
      alert('Failed to load bracket file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ── fullRenderCurrentBracket ─────────────────────────────────────────────

/**
 * Helper that loads the bracket's font (if Google), then renders.
 * Accepts render dependencies to avoid circular imports.
 *
 * @param {object} deps - { renderBracket, applyBracketStyles, applyFont, loadGoogleFont, isGoogleFont }
 */
export function fullRenderCurrentBracket(deps) {
  const bracket = state.bracket;
  const font = bracket.titleFont || 'sans-serif';
  function doRender() {
    deps.applyBracketStyles(bracket);
    deps.applyFont(bracket);
    deps.renderBracket(bracket);
  }
  if (deps.isGoogleFont(font)) {
    deps.loadGoogleFont(font).then(doRender);
  } else {
    doRender();
  }
}
