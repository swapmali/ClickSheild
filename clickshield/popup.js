/**
 * ClickShield — Popup Script
 * Manages the enable/disable toggle for the extension.
 */

(function () {
  "use strict";

  var toggle = document.getElementById("toggle");
  var label = document.getElementById("status-label");
  var hint = document.getElementById("hint-text");

  function updateUI(enabled) {
    toggle.checked = enabled;
    label.textContent = enabled ? "Enabled" : "Disabled";
    hint.textContent = enabled
      ? "Analyzing YouTube titles for clickbait."
      : "ClickShield is paused. Badges hidden.";
    document.body.classList.toggle("disabled", !enabled);
  }

  // Load current state
  chrome.storage.local.get("clickshield_enabled", function (result) {
    updateUI(result.clickshield_enabled !== false);
  });

  // Handle toggle
  toggle.addEventListener("change", function () {
    var enabled = toggle.checked;
    chrome.storage.local.set({ clickshield_enabled: enabled }, function () {
      updateUI(enabled);
    });
  });
})();
