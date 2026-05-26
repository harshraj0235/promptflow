/**
 * PromptFlow Pro — Shared Utilities Module
 * =========================================
 * A comprehensive collection of pure utility functions used across
 * the extension: popup, sidepanel, content scripts, options, and background.
 *
 * @module shared/utils
 */

/* ──────────────────────────────────────────────
 *  ID Generation
 * ──────────────────────────────────────────── */

/**
 * Generate a cryptographically-sound UUID v4 string.
 * Uses `crypto.randomUUID()` when available, with a
 * manual fallback for older environments.
 *
 * @returns {string} A UUID v4 string, e.g. "3b12f1df-5232-4e73-a8b5-..."
 */
export function generateId() {
  // Modern browsers and service workers support crypto.randomUUID
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: RFC-4122 compliant v4 UUID via getRandomValues
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
  );
}

/* ──────────────────────────────────────────────
 *  Timing Helpers
 * ──────────────────────────────────────────── */

/**
 * Create a debounced version of `fn` that delays invocation until
 * `delay` ms have elapsed since the last call.
 *
 * @param {Function} fn    — The function to debounce.
 * @param {number}   delay — Milliseconds to wait. Default 300.
 * @returns {Function} Debounced function with `.cancel()` method.
 */
export function debounce(fn, delay = 300) {
  let timerId = null;

  const debounced = (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn.apply(null, args);
      timerId = null;
    }, delay);
  };

  /** Cancel any pending invocation. */
  debounced.cancel = () => {
    clearTimeout(timerId);
    timerId = null;
  };

  return debounced;
}

/**
 * Create a throttled version of `fn` that invokes at most once
 * every `limit` ms.
 *
 * @param {Function} fn    — The function to throttle.
 * @param {number}   limit — Minimum interval in ms between calls.
 * @returns {Function} Throttled function.
 */
export function throttle(fn, limit = 300) {
  let waiting = false;
  let lastArgs = null;

  return (...args) => {
    if (waiting) {
      lastArgs = args;
      return;
    }

    fn.apply(null, args);
    waiting = true;

    setTimeout(() => {
      waiting = false;
      if (lastArgs) {
        fn.apply(null, lastArgs);
        lastArgs = null;
      }
    }, limit);
  };
}

/* ──────────────────────────────────────────────
 *  Date / Time Formatting
 * ──────────────────────────────────────────── */

/**
 * Format a date into a human-friendly relative time string.
 *
 * @param {Date|string|number} date — Date object, ISO string, or timestamp.
 * @returns {string} e.g. "just now", "2 hours ago", "3 days ago"
 */
export function formatDate(date) {
  const now = Date.now();
  const then = new Date(date).getTime();

  if (Number.isNaN(then)) return 'Unknown date';

  const diffSec = Math.round((now - then) / 1000);

  if (diffSec < 0) return 'just now'; // future dates collapse to "just now"
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs === 1) return '1 hour ago';
  if (diffHrs < 24) return `${diffHrs} hours ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return '1 week ago';
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  if (diffMonths < 12) return `${diffMonths} months ago`;

  const diffYears = Math.floor(diffDays / 365);
  if (diffYears === 1) return '1 year ago';
  return `${diffYears} years ago`;
}

/* ──────────────────────────────────────────────
 *  String Manipulation
 * ──────────────────────────────────────────── */

/**
 * Escape HTML entities to prevent XSS when injecting into the DOM.
 *
 * @param {string} str — Raw string.
 * @returns {string} Escaped string safe for innerHTML.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, (ch) => map[ch]);
}

/**
 * Truncate text to `maxLen` characters, appending an ellipsis when cut.
 *
 * @param {string} str    — Input text.
 * @param {number} maxLen — Maximum length. Default 100.
 * @returns {string}
 */
export function truncateText(str, maxLen = 100) {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLen) return str;
  // Cut at the last space boundary within maxLen to avoid mid-word breaks
  const trimmed = str.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? trimmed.slice(0, lastSpace) : trimmed) + '…';
}

/**
 * Sanitize user input by stripping potentially dangerous content.
 * Removes script tags, event handlers, and dangerous protocols.
 *
 * @param {string} str — Raw user input.
 * @returns {string} Sanitized string.
 */
export function sanitizeInput(str) {
  if (typeof str !== 'string') return '';

  return str
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove on* event handlers from tags
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: / data: protocols from href/src
    .replace(/(?:href|src)\s*=\s*(?:"(?:javascript|data):[^"]*"|'(?:javascript|data):[^']*')/gi, '')
    // Remove embedded iframes
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove object / embed tags
    .replace(/<\/?(?:object|embed|applet)[^>]*>/gi, '')
    .trim();
}

/**
 * Calculate approximate reading time for a block of text.
 *
 * @param {string} text — The text content.
 * @param {number} [wpm=200] — Words per minute.
 * @returns {{ minutes: number, words: number, display: string }}
 */
export function calculateReadingTime(text, wpm = 200) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { minutes: 0, words: 0, display: '0 min read' };
  }

  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / wpm));

  return {
    minutes,
    words,
    display: minutes === 1 ? '1 min read' : `${minutes} min read`,
  };
}

/* ──────────────────────────────────────────────
 *  Deep Clone
 * ──────────────────────────────────────────── */

/**
 * Produce a deep clone of any JSON-serialisable value.
 * Uses `structuredClone` when available, else falls back to
 * JSON round-trip.
 *
 * @template T
 * @param {T} obj — The value to clone.
 * @returns {T} A deep copy.
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      // structuredClone fails for certain non-serialisable values
    }
  }

  return JSON.parse(JSON.stringify(obj));
}

/* ──────────────────────────────────────────────
 *  Fuzzy Search
 * ──────────────────────────────────────────── */

/**
 * Perform a fuzzy (approximate) search across an array of items.
 *
 * Each character of `query` must appear in-order within the target
 * value, but gaps are allowed. Results are ranked by match quality.
 *
 * @param {string}   query — Search query.
 * @param {Object[]} items — Array of objects to search through.
 * @param {string}   key   — Property name to compare against.
 * @returns {Object[]} Matching items sorted by relevance (best first).
 */
export function fuzzySearch(query, items, key) {
  if (!query || !items?.length) return items ?? [];

  const lowerQuery = query.toLowerCase().trim();
  if (lowerQuery.length === 0) return items;

  /**
   * Compute a fuzzy match score. Higher is better.
   * Returns -1 if no match.
   */
  const score = (target) => {
    const lowerTarget = target.toLowerCase();

    // Exact match — highest priority
    if (lowerTarget === lowerQuery) return 1000;

    // Starts-with match
    if (lowerTarget.startsWith(lowerQuery)) return 900 + (lowerQuery.length / lowerTarget.length) * 100;

    // Contains match
    if (lowerTarget.includes(lowerQuery)) return 700 + (lowerQuery.length / lowerTarget.length) * 100;

    // Fuzzy character-by-character match
    let qi = 0;
    let consecutiveBonus = 0;
    let totalGaps = 0;
    let lastMatchIdx = -2;

    for (let ti = 0; ti < lowerTarget.length && qi < lowerQuery.length; ti++) {
      if (lowerTarget[ti] === lowerQuery[qi]) {
        // Reward consecutive matches
        if (ti === lastMatchIdx + 1) {
          consecutiveBonus += 10;
        } else {
          totalGaps += ti - lastMatchIdx - 1;
        }
        lastMatchIdx = ti;
        qi++;
      }
    }

    // All query chars must match
    if (qi < lowerQuery.length) return -1;

    // Base score minus penalty for gaps, plus bonus for consecutives
    return Math.max(0, 500 - totalGaps * 5 + consecutiveBonus);
  };

  return items
    .map((item) => {
      const value = typeof item === 'string' ? item : item?.[key];
      if (typeof value !== 'string') return { item, score: -1 };
      return { item, score: score(value) };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/* ──────────────────────────────────────────────
 *  Template Variable Handling
 * ──────────────────────────────────────────── */

/**
 * Extract all `{{variable}}` placeholders from a template string.
 *
 * @param {string} template — The template text.
 * @returns {string[]} Array of unique variable names (without braces).
 *
 * @example
 * parseVariables('Hello {{name}}, your role is {{role}}.')
 * // → ['name', 'role']
 */
export function parseVariables(template) {
  if (typeof template !== 'string') return [];

  const regex = /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g;
  const vars = new Set();
  let match;

  while ((match = regex.exec(template)) !== null) {
    vars.add(match[1]);
  }

  return [...vars];
}

/**
 * Replace `{{variable}}` placeholders in a template with actual values.
 *
 * @param {string}               template — The template string.
 * @param {Record<string,string>} values  — Map of variable name → value.
 * @returns {string} The filled template. Unmatched placeholders remain intact.
 *
 * @example
 * fillVariables('Hello {{name}}!', { name: 'Alice' })
 * // → 'Hello Alice!'
 */
export function fillVariables(template, values) {
  if (typeof template !== 'string') return '';
  if (!values || typeof values !== 'object') return template;

  return template.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (full, varName) => {
    return Object.prototype.hasOwnProperty.call(values, varName)
      ? String(values[varName])
      : full; // leave unmatched placeholders as-is
  });
}

/* ──────────────────────────────────────────────
 *  Import / Export
 * ──────────────────────────────────────────── */

/**
 * Trigger a browser download of `data` as a JSON file.
 *
 * @param {*}      data     — Any JSON-serialisable value.
 * @param {string} [filename='promptflow-export.json'] — Download filename.
 */
export function exportToJSON(data, filename = 'promptflow-export.json') {
  try {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
      anchor.remove();
    }, 100);
  } catch (err) {
    console.error('[PromptFlow] Export failed:', err);
    throw new Error(`Export failed: ${err.message}`);
  }
}

/**
 * Open a file picker dialog and import a JSON file.
 * Returns a Promise that resolves with the parsed data.
 *
 * @returns {Promise<*>} Parsed JSON content.
 */
export function importFromJSON() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        input.remove();
        return reject(new Error('No file selected'));
      }

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const data = JSON.parse(/** @type {string} */ (reader.result));
          resolve(data);
        } catch (err) {
          reject(new Error(`Invalid JSON file: ${err.message}`));
        } finally {
          input.remove();
        }
      };

      reader.onerror = () => {
        input.remove();
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });

    // Handle user cancellation (no file chosen)
    input.addEventListener('cancel', () => {
      input.remove();
      reject(new Error('File selection cancelled'));
    });

    input.click();
  });
}

/* ──────────────────────────────────────────────
 *  Toast Notifications
 * ──────────────────────────────────────────── */

/** @type {HTMLElement|null} Cached toast container reference */
let _toastContainer = null;

/**
 * Show an injectable toast notification.
 * Auto-creates a styled container in the DOM on first use.
 *
 * @param {string} message — Toast text.
 * @param {'success'|'error'|'info'|'warning'} [type='info'] — Visual style.
 * @param {number} [duration=3000] — Time in ms before auto-dismiss.
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Ensure we have a container
  if (!_toastContainer || !document.body.contains(_toastContainer)) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'promptflow-toast-container';
    Object.assign(_toastContainer.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: '2147483647', // max z-index for content-script contexts
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    });
    document.body.appendChild(_toastContainer);
  }

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const colorMap = {
    success: { bg: 'rgba(46,204,113,0.95)', border: '#27ae60' },
    error:   { bg: 'rgba(231,76,60,0.95)',   border: '#c0392b' },
    warning: { bg: 'rgba(241,196,15,0.95)',   border: '#f39c12' },
    info:    { bg: 'rgba(108,92,231,0.95)',   border: '#5b4cdb' },
  };

  const colors = colorMap[type] || colorMap.info;

  const toast = document.createElement('div');
  toast.setAttribute('role', 'alert');
  Object.assign(toast.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    borderRadius: '12px',
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
    backdropFilter: 'blur(12px)',
    pointerEvents: 'auto',
    transform: 'translateX(120%)',
    transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
    opacity: '0',
    cursor: 'pointer',
    maxWidth: '380px',
    lineHeight: '1.4',
  });

  toast.innerHTML = `
    <span style="font-size:18px;flex-shrink:0">${iconMap[type] || iconMap.info}</span>
    <span>${escapeHtml(message)}</span>
  `;

  // Dismiss on click
  toast.addEventListener('click', () => dismiss());

  _toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  const dismiss = () => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 350);
  };

  // Auto-dismiss
  setTimeout(dismiss, duration);
}

/* ──────────────────────────────────────────────
 *  Clipboard
 * ──────────────────────────────────────────── */

/**
 * Copy text to the system clipboard.
 * Falls back to execCommand for older contexts (e.g. some content scripts).
 *
 * @param {string} text — The text to copy.
 * @returns {Promise<boolean>} `true` if successful.
 */
export async function copyToClipboard(text) {
  // Modern Clipboard API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy approach
    }
  }

  // Legacy fallback using a temporary textarea
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    Object.assign(textarea.style, {
      position: 'fixed',
      left: '-9999px',
      top: '-9999px',
      opacity: '0',
    });
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch (err) {
    console.error('[PromptFlow] Copy to clipboard failed:', err);
    return false;
  }
}
