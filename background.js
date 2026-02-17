/**
 * ClickShield — Background Service Worker
 * Routes title analysis requests, manages caching,
 * deduplicates in-flight API calls, and handles enable/disable state.
 */

import { getScore, setScore } from "./cache.js";
import { analyzeTitle } from "./detector.js";
import { normalizeTitle } from "./utils.js";

const pendingRequests = new Map();

/**
 * Check if the extension is enabled.
 * @returns {Promise<boolean>}
 */
async function isEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get("clickshield_enabled", (result) => {
      resolve(result.clickshield_enabled !== false);
    });
  });
}

/**
 * Process a title analysis request.
 * Normalized title is used for caching/dedup; raw title is sent to OpenAI.
 */
async function handleAnalyzeRequest(rawTitle) {
  if (!(await isEnabled())) {
    return { error: "ClickShield is disabled." };
  }

  const normalized = normalizeTitle(rawTitle);
  if (!normalized) return { error: "Empty title." };

  try {
    const cached = await getScore(normalized);
    if (cached !== null) return { score: cached };
  } catch (_) { /* cache miss */ }

  if (pendingRequests.has(normalized)) {
    return pendingRequests.get(normalized);
  }

  const promise = (async () => {
    try {
      const score = await analyzeTitle(rawTitle);
      await setScore(normalized, score);
      return { score };
    } catch (err) {
      return { error: err.message };
    } finally {
      pendingRequests.delete(normalized);
    }
  })();

  pendingRequests.set(normalized, promise);
  return promise;
}

// Message listener
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ANALYZE_TITLE" && message.title) {
    handleAnalyzeRequest(message.title)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message || "Unknown error" }));
    return true;
  }

  if (message.type === "GET_STATE") {
    isEnabled().then((on) => sendResponse({ enabled: on }));
    return true;
  }
});

// Inject into already-open YouTube tabs on install/update/startup
async function injectIntoExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
    for (const tab of tabs) {
      try {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["styles.css"] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      } catch (_) { /* tab may not be injectable */ }
    }
  } catch (_) { /* ignore */ }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("clickshield_enabled", (result) => {
    if (result.clickshield_enabled === undefined) {
      chrome.storage.local.set({ clickshield_enabled: true });
    }
  });
  injectIntoExistingTabs();
});

chrome.runtime.onStartup.addListener(() => {
  injectIntoExistingTabs();
});
