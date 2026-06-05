# LinkLessData 🌐🔗

LinkLessData is a self-hosted, developer-centric **URL Preview & Metadata Extraction Service** equipped with a premium diagnostic dashboard workbench. It is designed to scrap, parse, crawl, and preview meta tags, structured schema trees, RSS sitemaps, and readability articles with developer-focused metrics.

---

## 🚀 Features & Capabilities

### 🔍 1. Dual-Phase Scraping Engine
*   **Phase 1 (Fast Crawl)**: Instant HTTP download using `axios` and metadata extraction using `cheerio`.
*   **Phase 2 (Dynamic Rendering)**: Automatic headless Chromium fallback (via `playwright`) if the target site is a Single Page Application (SPA, React/Vue/Next.js) or blocks standard HTTP requests.
*   **X (formerly Twitter) Bypasses**: Dynamic routing utilizing public `api.fxtwitter.com` REST interfaces and `fxtwitter.com` HTML proxies to scrape tweets, authors, media assets, and screenshots without being blocked by login walls.

### 🎭 2. Custom User-Agent Selector
*   Override the crawler's persona to test paywalls, crawler limits, or crawler-specific markup.
*   Preconfigured UA options include:
    *   *Default (LinkLessData-Scraper)*
    *   *Desktop Chrome*
    *   *Googlebot 2.1 Crawler*
    *   *Discordbot 2.0*
    *   *Mobile Safari (iPhone)*

### 🧭 3. Interactive Feed Explorer
*   Scrape and extract child links from **XML Sitemaps**, **RSS feeds**, or **Atom feeds**.
*   Exposes `/api/feed/explore` to automatically load child links directly into the Bulk Scraper workspace, expanding settings and scrolling to the batch queue.

### 🔐 4. HMAC-SHA256 Webhook Signatures
*   Register webhooks globally to track completed crawls.
*   Each subscriber receives a unique key (`whsec_...`).
*   Outgoing payloads are signed using **HMAC-SHA256** and contain headers:
    *   `X-LinkLess-Signature`: `sha256=<signature_hex>`
    *   `X-LinkLess-Timestamp`: Unix millisecond timestamp
*   Includes a 3-attempt linear backoff delivery retry queue with a terminal logger.

### 📊 5. JSON-LD Structured Schema Inspector
*   Detects and parses all inline `application/ld+json` script schemas.
*   Displays Schema.org objects in an interactive HTML `<details>` accordion tree with smooth arrow rotations.

### 🎨 6. Social Embed Mockups
*   Live previews of how a scraped link appears on **Discord**, **Slack**, **Twitter / X**, and **LinkedIn**.
*   Discord and Slack side accent bars dynamically adapt their HSL border colors to match the target site's **dominant brand color** (extracted from images/favicons using `Jimp`).

### 💾 7. Persisted SQLite Cache & Analytics
*   Saves crawl previews to a local SQLite database for sub-millisecond loads on repeat queries.
*   Tracks service stats (Total requests, cache hit rate %, average latencies).

### 🔑 8. Developer API Credentials & Quotas
*   Generate unique tokens (`sk_live_...`) to authorize external machine-to-machine integrations.
*   Tracks and limits requests to `1000` calls per active key.

---

## 🛠️ Tech Stack

*   **Runtime**: Node.js (ES Modules)
*   **Backend Framework**: Express.js
*   **Database**: SQLite (`sqlite3`)
*   **HTML Scraping & DOM Parser**: Cheerio, JSOM, Mozilla Readability
*   **Headless Browser Engine**: Playwright (Chromium)
*   **Image Brand Analyzer**: Jimp (pixel-group frequency clustering)
*   **Frontend**: Vanilla HTML5, CSS Custom Properties (Theme toggle support, glassmorphism UI), Lucide Icons

---

## 📥 Installation & Local Setup

### 1. Prerequisites
Ensure you have **Node.js** (v18+) installed.

### 2. Clone and Install Dependencies
```bash
npm install
```

### 3. Install Headless Browser Binaries
```bash
npx playwright install chromium
```

### 4. Launch the Server
Start the Express API server (listening on port `3000` by default):
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your web browser to access the dashboard.

---

## 🔌 API Endpoints Reference

### Previews
*   `GET /api/preview`
    *   **Params**: `url` (required), `screenshot` (true/false), `refresh` (true/false), `userAgent` (override string), `selectors` (CSS extraction string/JSON e.g. `price:.price-val`).
    *   **Headers**: `X-API-Key` (for machine integrations)
*   `POST /api/preview/batch`
    *   Crawl up to 10 URLs asynchronously. Supports body parameters: `urls: []`, `webhookUrl: ""`, and `screenshot: true/false`.
*   `GET /api/preview/pdf`
    *   Downloads a clutter-free, print-optimized A4 PDF document compiled from the page's readability article.

### Feeds
*   `GET /api/feed/explore?url=<feed_url>`
    *   Parses sitemaps and feed channels, returning an array of resolved child URLs.

### Credentials
*   `POST /api/keys` (Create token)
*   `GET /api/keys` (List tokens)
*   `DELETE /api/keys?apiKey=<key>` (Revoke token)

### Webhooks
*   `POST /api/webhooks/subscribe` (Body: `url`)
*   `GET /api/webhooks` (List webhooks & secrets)
*   `DELETE /api/webhooks/unsubscribe?url=<url>`
*   `GET /api/webhooks/history` (Retrieve delivery logs)

---

## 🧪 Running Advanced Feature Tests
We have built an integrated automated unit test suite. Run:
```bash
node src/test-advanced-features.js
```
This runs a mock Express web server locally and asserts:
1.  Sitemap/RSS XML parsing counts and outputs.
2.  Dynamic custom User-Agent propagation.
3.  JSON-LD object extraction schema verification.
4.  HMAC-SHA256 cryptographic webhook header signature checks.

---

## 📄 License
This project is licensed under the MIT License.
