/**
 * ClickShield — Content Script
 * Detects video titles on YouTube, requests clickbait analysis from the
 * background service worker, and injects score badges next to titles.
 * Uses multiple detection strategies to handle YouTube DOM changes.
 */

(function () {
  "use strict";

  if (window.__clickshield_loaded) return;
  window.__clickshield_loaded = true;

  // ── Constants ──

  var PROCESSED_ATTR = "data-clickshield";
  var BADGE_CLASS = "clickshield-badge";
  var SCAN_DEBOUNCE_MS = 600;
  var INITIAL_DELAY_MS = 2500;
  var RETRY_DELAY_MS = 3000;
  var MAX_RETRIES = 10;
  var MSG_RETRY_DELAY = 1500;
  var MSG_MAX_RETRIES = 3;

  // ── State ──

  var enabled = true;
  var titleScores = new Map();
  var pendingElements = new Map();

  // ── Enabled State ──

  function loadEnabledState(cb) {
    chrome.storage.local.get("clickshield_enabled", function (result) {
      if (chrome.runtime.lastError) { cb(true); return; }
      enabled = result.clickshield_enabled !== false;
      cb(enabled);
    });
  }

  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.clickshield_enabled) {
      enabled = changes.clickshield_enabled.newValue !== false;
      if (enabled) {
        scanTitles();
      } else {
        removeBadges();
      }
    }
  });

  function removeBadges() {
    document.querySelectorAll("." + BADGE_CLASS).forEach(function (el) {
      el.remove();
    });
    document.querySelectorAll("[" + PROCESSED_ATTR + "]").forEach(function (el) {
      el.removeAttribute(PROCESSED_ATTR);
    });
    titleScores.clear();
    pendingElements.clear();
  }

  // ── Helpers ──

  function extractTitle(el) {
    var t = el.getAttribute("title");
    if (t && t.trim().length > 2) return t.trim();
    t = el.getAttribute("aria-label");
    if (t && t.trim().length > 2) return t.trim();
    t = el.textContent;
    if (t && t.trim().length > 2) return t.trim();
    return "";
  }

  function normalizeTitle(title) {
    if (!title) return "";
    return title.trim().replace(/\s+/g, " ").toLowerCase();
  }

  function getBadgeStyle(score) {
    if (score <= 30) return { emoji: "\u{1F7E2}", cls: "clickshield-badge--green" };
    if (score <= 70) return { emoji: "\u{1F7E1}", cls: "clickshield-badge--yellow" };
    return { emoji: "\u{1F534}", cls: "clickshield-badge--red" };
  }

  // ── Title Element Discovery ──

  function findTitleElements() {
    var found;

    // Strategy 1: Classic ID selectors
    var classic = ["a#video-title", "#video-title", "a#video-title-link", "yt-formatted-string#video-title"];
    for (var i = 0; i < classic.length; i++) {
      found = document.querySelectorAll(classic[i]);
      if (found.length > 0) return found;
    }

    // Strategy 2: Watch links with title attribute (most robust)
    found = document.querySelectorAll('a[href*="/watch?v="][title]');
    if (found.length > 0) {
      var filtered = [];
      found.forEach(function (el) {
        if ((el.getAttribute("title") || "").length > 5) filtered.push(el);
      });
      if (filtered.length > 0) return filtered;
    }

    // Strategy 3: Watch links with substantial text (not thumbnails)
    var watchLinks = document.querySelectorAll('a[href*="/watch?v="]');
    if (watchLinks.length > 0) {
      var textLinks = [];
      watchLinks.forEach(function (el) {
        var text = el.textContent.trim();
        if (text.length < 8) return;
        if (el.querySelectorAll("img, yt-img-shadow, ytd-thumbnail").length > 0 && text.length < 30) return;
        textLinks.push(el);
      });
      if (textLinks.length > 0) return textLinks;
    }

    // Strategy 4: Partial ID match
    found = document.querySelectorAll('[id*="video-title"]');
    if (found.length > 0) return found;

    // Strategy 5: Renderer-based selectors
    var renderers = [
      "ytd-rich-item-renderer h3 a", "ytd-video-renderer h3 a",
      "ytd-compact-video-renderer h3 a", "ytd-grid-video-renderer h3 a",
      "yt-lockup-view-model h3 a", "yt-lockup-view-model a[href*='/watch']",
    ];
    for (var j = 0; j < renderers.length; j++) {
      found = document.querySelectorAll(renderers[j]);
      if (found.length > 0) return found;
    }

    // Strategy 6: Shadow DOM traversal
    var shadowResults = [];
    deepFindTitles(document.body, shadowResults);
    if (shadowResults.length > 0) return shadowResults;

    return [];
  }

  function deepFindTitles(root, results) {
    if (!root) return;
    var found = root.querySelectorAll('a#video-title, #video-title, a[href*="/watch?v="][title]');
    for (var i = 0; i < found.length; i++) results.push(found[i]);
    var all = root.querySelectorAll("*");
    for (var j = 0; j < all.length && results.length === 0; j++) {
      if (all[j].shadowRoot) deepFindTitles(all[j].shadowRoot, results);
    }
  }

  // ── Badge Injection ──

  function injectBadge(titleEl, score) {
    if (!titleEl || typeof score !== "number" || !titleEl.isConnected) return;
    var parent = titleEl.closest("h3") || titleEl.closest("#meta")
      || titleEl.closest("#details") || titleEl.parentElement;
    if (!parent || parent.querySelector("." + BADGE_CLASS)) return;

    var style = getBadgeStyle(score);
    var badge = document.createElement("span");
    badge.className = BADGE_CLASS + " " + style.cls;
    badge.textContent = style.emoji + " " + score + "%";
    badge.setAttribute("title", "ClickShield: " + score + "% clickbait probability");

    try { titleEl.after(badge); } catch (_) {
      try { parent.appendChild(badge); } catch (_2) { /* skip */ }
    }
  }

  // ── Messaging with Retry ──

  function sendAnalyzeMessage(rawTitle, callback, attempt) {
    attempt = attempt || 0;
    try {
      chrome.runtime.sendMessage(
        { type: "ANALYZE_TITLE", title: rawTitle },
        function (response) {
          if (chrome.runtime.lastError) {
            if (attempt < MSG_MAX_RETRIES) {
              setTimeout(function () { sendAnalyzeMessage(rawTitle, callback, attempt + 1); },
                MSG_RETRY_DELAY * (attempt + 1));
            } else { callback(null); }
            return;
          }
          callback(response);
        }
      );
    } catch (_) {
      if (attempt < MSG_MAX_RETRIES) {
        setTimeout(function () { sendAnalyzeMessage(rawTitle, callback, attempt + 1); },
          MSG_RETRY_DELAY * (attempt + 1));
      } else { callback(null); }
    }
  }

  // ── Title Processing ──

  function processTitleElement(titleEl) {
    if (!enabled) return;
    if (titleEl.hasAttribute && titleEl.hasAttribute(PROCESSED_ATTR)) return;
    var rawTitle = extractTitle(titleEl);
    if (!rawTitle) return;
    if (titleEl.setAttribute) titleEl.setAttribute(PROCESSED_ATTR, "1");

    var key = normalizeTitle(rawTitle);

    if (titleScores.has(key) && typeof titleScores.get(key) === "number") {
      injectBadge(titleEl, titleScores.get(key));
      return;
    }
    if (titleScores.has(key)) {
      if (!pendingElements.has(key)) pendingElements.set(key, []);
      pendingElements.get(key).push(titleEl);
      return;
    }

    titleScores.set(key, null);
    pendingElements.set(key, [titleEl]);

    sendAnalyzeMessage(rawTitle, function (response) {
      if (response && typeof response.score === "number") {
        titleScores.set(key, response.score);
        (pendingElements.get(key) || []).forEach(function (el) { injectBadge(el, response.score); });
        pendingElements.delete(key);
      } else {
        titleScores.delete(key);
        (pendingElements.get(key) || []).forEach(function (el) {
          if (el.removeAttribute) el.removeAttribute(PROCESSED_ATTR);
        });
        pendingElements.delete(key);
      }
    });
  }

  // ── Scanning ──

  function scanTitles() {
    if (!enabled) return;
    var elements = findTitleElements();
    if (!elements || elements.length === 0) return;
    var arr = elements instanceof NodeList ? Array.from(elements) : elements;
    arr.forEach(function (el) { processTitleElement(el); });
  }

  var scanTimer = null;
  function debouncedScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () { scanTimer = null; scanTitles(); }, SCAN_DEBOUNCE_MS);
  }

  function initialScan(attempt) {
    if (!enabled) return;
    var elements = findTitleElements();
    var count = elements ? elements.length : 0;
    if (count > 0) { scanTitles(); }
    else if (attempt < MAX_RETRIES) {
      setTimeout(function () { initialScan(attempt + 1); }, RETRY_DELAY_MS);
    }
  }

  // ── Observers ──

  function startObserver() {
    new MutationObserver(function () { debouncedScan(); })
      .observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  function listenForNavigation() {
    document.addEventListener("yt-navigate-finish", function () {
      setTimeout(function () { initialScan(0); }, INITIAL_DELAY_MS);
    });
    window.addEventListener("popstate", function () {
      setTimeout(function () { scanTitles(); }, INITIAL_DELAY_MS);
    });
  }

  // ── Bootstrap ──

  function boot() {
    listenForNavigation();
    startObserver();
    loadEnabledState(function () {
      setTimeout(function () { initialScan(0); }, INITIAL_DELAY_MS);
    });
  }

  if (document.body) { boot(); }
  else { document.addEventListener("DOMContentLoaded", boot); }
})();
