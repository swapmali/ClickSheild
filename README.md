# ClickShield

**Expose clickbait instantly.**

ClickShield is a Chrome Extension that detects clickbait YouTube video titles using the OpenAI API and displays a real-time clickbait probability badge next to each video title.

---

## Features

- **AI-Powered Detection** — Uses OpenAI's `gpt-4o-mini` model to analyze YouTube video titles for clickbait patterns.
- **Real-Time Badges** — Displays a color-coded probability badge next to every video title.
- **Enable / Disable Toggle** — Click the extension icon to pause or resume analysis instantly.
- **Smart Caching** — Caches results for 30 days using `chrome.storage.local` to minimize API calls.
- **Dynamic Detection** — Uses MutationObserver to handle YouTube's infinite scroll and SPA navigation.
- **Adaptive Selectors** — Multiple detection strategies handle YouTube DOM changes automatically.
- **Duplicate Prevention** — Deduplicates both DOM processing and in-flight API requests.
- **Secure by Design** — API key is stored in a git-ignored local config file and never committed.

---

## Score Color Coding

| Score Range | Color  | Meaning          |
|-------------|--------|------------------|
| 0-30%       | Green  | Likely genuine     |
| 31-70%      | Yellow | Possibly clickbait |
| 71-100%     | Red    | Likely clickbait   |

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ClickShield.git
cd ClickShield
```

### 2. Add Your OpenAI API Key

Copy the example config and add your key:

```bash
cp config.local.example.js config.local.js
```

Then edit `config.local.js`:

```javascript
export const OPENAI_API_KEY = "sk-your-actual-api-key-here";
```

> **Security Note:** `config.local.js` is listed in `.gitignore` and will never be committed to version control.

### 3. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the project root folder (the one containing `manifest.json`)
5. The ClickShield extension will appear in your extensions list

### 4. Visit YouTube

Navigate to [https://www.youtube.com](https://www.youtube.com) and clickbait probability badges will appear next to video titles.

### 5. Enable / Disable

Click the ClickShield icon in the Chrome toolbar to open the popup. Use the toggle switch to enable or disable analysis. When disabled, all badges are hidden and no API calls are made.

---

## Architecture

```
ClickShield/
├── manifest.json             # Extension manifest (MV3)
├── content.js                # Content script — DOM observation and badge injection
├── background.js             # Service worker — routing, caching, dedup, enable state
├── detector.js               # OpenAI API integration
├── overlay.js                # Badge creation utilities
├── cache.js                  # chrome.storage.local cache with 30-day TTL
├── constants.js              # Shared configuration constants
├── utils.js                  # Helper functions (normalize, hash, debounce)
├── styles.css                # Badge visual styles
├── popup.html                # Extension popup UI
├── popup.js                  # Popup toggle logic
├── popup.css                 # Popup visual styles
├── config.local.js           # Local API key (git-ignored)
├── config.local.example.js   # API key template (committed)
├── .gitignore                # Git ignore rules
├── README.md                 # This file
└── icons/                    # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Data Flow

```
YouTube Page (content.js)
    │
    ├─ MutationObserver detects video titles
    ├─ Multi-strategy selector finds title elements
    ├─ Sends ANALYZE_TITLE message to background
    │
    ▼
Background Service Worker (background.js)
    │
    ├─ Checks enabled state
    ├─ Checks chrome.storage.local cache (cache.js)
    ├─ If cached → returns immediately
    ├─ If in-flight → awaits existing request
    ├─ If new → calls OpenAI API (detector.js)
    ├─ Caches result for 30 days
    │
    ▼
Content Script receives score
    │
    ├─ Creates color-coded badge
    ├─ Injects badge next to video title
    └─ Done

Popup (popup.html)
    │
    ├─ Toggle writes enabled state to chrome.storage.local
    └─ Content script reacts: shows or removes badges
```

---

## Security

- **API Key Isolation**: The OpenAI API key lives exclusively in `config.local.js`, which is git-ignored.
- **No Hardcoded Secrets**: No API keys, tokens, or credentials exist in any tracked source file.
- **Minimal Permissions**: `storage` and `scripting` — plus host access to YouTube and OpenAI only.
- **Input Sanitization**: Titles are normalized before processing and cache key generation.

---

## Performance

- **Aggressive Caching**: Results are cached for 30 days, dramatically reducing API calls.
- **Request Deduplication**: Concurrent requests for the same title share a single API call.
- **Debounced Scanning**: DOM scans are debounced to prevent excessive processing during scroll.
- **Non-Blocking**: All API calls are asynchronous and never block the YouTube UI.
- **Lazy Injection**: Already-open YouTube tabs are injected on extension install/startup.

---

## Error Handling

- API failures are caught silently without crashing the extension.
- Network errors are retried up to 3 times with backoff.
- Invalid API responses (non-numeric, out of range) are safely rejected.
- Cache read/write errors are handled gracefully with fallback behavior.

---

## Requirements

- Google Chrome (version 88+ for Manifest V3 support)
- OpenAI API key with access to the `gpt-4o-mini` model

---

## License

MIT
