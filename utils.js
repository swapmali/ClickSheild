/**
 * ClickShield — Utilities
 * Shared helper functions.
 */

/**
 * Normalize a video title for consistent caching.
 * Trims whitespace, collapses internal whitespace, and lowercases.
 * @param {string} title - Raw title text
 * @returns {string} Normalized title
 */
export function normalizeTitle(title) {
  if (!title || typeof title !== "string") return "";
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Generate a deterministic cache key from a title.
 * Uses a simple but reliable string hash.
 * @param {string} title - Normalized title
 * @returns {string} Cache key prefixed with "cs_"
 */
export function generateCacheKey(title) {
  const normalized = normalizeTitle(title);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return "cs_" + Math.abs(hash).toString(36);
}

/**
 * Debounce a function call.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}
