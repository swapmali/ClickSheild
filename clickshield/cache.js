/**
 * ClickShield — Cache
 * Persistent cache using chrome.storage.local with 30-day TTL.
 */

import { CACHE_DURATION } from "./constants.js";
import { generateCacheKey } from "./utils.js";

/**
 * Retrieve a cached clickbait score for a title.
 * @param {string} title - Normalized title
 * @returns {Promise<number|null>}
 */
export async function getScore(title) {
  const key = generateCacheKey(title);
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      const entry = result[key];
      if (!entry) { resolve(null); return; }
      if (Date.now() - entry.timestamp > CACHE_DURATION) {
        chrome.storage.local.remove(key);
        resolve(null);
        return;
      }
      resolve(entry.score);
    });
  });
}

/**
 * Store a clickbait score in the cache.
 * @param {string} title - Normalized title
 * @param {number} score - Clickbait probability (0–100)
 * @returns {Promise<void>}
 */
export async function setScore(title, score) {
  const key = generateCacheKey(title);
  return new Promise((resolve) => {
    chrome.storage.local.set(
      { [key]: { score, title, timestamp: Date.now() } },
      () => resolve()
    );
  });
}
