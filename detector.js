/**
 * ClickShield — Detector
 * Calls the OpenAI API to analyze a YouTube title for clickbait probability.
 */

import { OPENAI_API_URL, MODEL_NAME } from "./constants.js";
import { OPENAI_API_KEY } from "./config.local.js";

/**
 * Analyze a title and return a clickbait probability score (0–100).
 * @param {string} title - The YouTube video title to analyze
 * @returns {Promise<number>} Clickbait probability score
 * @throws {Error} On network failure or unexpected API response
 */
export async function analyzeTitle(title) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your_api_key_here") {
    throw new Error("OpenAI API key is not configured. Edit config.local.js with your key.");
  }

  const prompt = `Analyze the following YouTube video title and return a clickbait probability score from 0 to 100.\n\nReturn ONLY a number.\n\nTitle: ${title}`;

  let response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });
  } catch (networkError) {
    throw new Error(`[ClickShield] Network error: ${networkError.message}`);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`[ClickShield] API error ${response.status}: ${errorBody}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error("[ClickShield] Failed to parse API response as JSON.");
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("[ClickShield] Empty response from API.");
  }

  const score = parseInt(content.trim(), 10);
  if (isNaN(score) || score < 0 || score > 100) {
    throw new Error(`[ClickShield] Invalid score received: "${content.trim()}"`);
  }

  return score;
}
