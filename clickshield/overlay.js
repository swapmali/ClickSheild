/**
 * ClickShield — Overlay
 * Creates and injects the clickbait score badge next to video titles.
 * Badge is placed as a sibling (not a child) of the title element
 * to avoid breaking YouTube's link styling.
 */

/**
 * Get the badge emoji and CSS class based on the score.
 * @param {number} score - Clickbait probability (0–100)
 * @returns {{ emoji: string, className: string }}
 */
function getBadgeStyle(score) {
  if (score <= 30) {
    return { emoji: "🟢", className: "clickshield-badge--green" };
  } else if (score <= 70) {
    return { emoji: "🟡", className: "clickshield-badge--yellow" };
  } else {
    return { emoji: "🔴", className: "clickshield-badge--red" };
  }
}

/**
 * Create and inject a clickbait badge next to a video title element.
 * Prevents duplicate badges on the same element.
 * @param {HTMLElement} titleElement - The video-title element
 * @param {number} score - Clickbait probability (0–100)
 */
export function injectBadge(titleElement, score) {
  if (!titleElement || typeof score !== "number") return;

  const parent = titleElement.closest("h3") || titleElement.parentElement;
  if (!parent) return;

  if (parent.querySelector(".clickshield-badge")) return;

  const { emoji, className } = getBadgeStyle(score);

  const badge = document.createElement("span");
  badge.className = `clickshield-badge ${className}`;
  badge.textContent = `${emoji} ${score}%`;
  badge.setAttribute("title", `ClickShield: ${score}% clickbait probability`);

  if (titleElement.nextSibling) {
    parent.insertBefore(badge, titleElement.nextSibling);
  } else {
    parent.appendChild(badge);
  }
}
