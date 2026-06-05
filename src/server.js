import express from 'express';
import cors from 'cors';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { cache } from './cache.js';
import { scrapeUrl } from './scraper.js';
import { webhookManager } from './webhook.js';
import { generatePdf } from './screenshot.js';
import { exploreFeedUrls } from './feed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend API accessibility
app.use(cors());

// Parse incoming request payloads
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// Set up API Rate Limiting to prevent scraping abuse
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 API requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many API requests, please wait 60 seconds.' }
});

app.use('/api/', apiLimiter);

/**
 * GET /api/preview
 * Main metadata extraction endpoint
 */
// Middleware to authorize requests using Developer API Keys
async function checkAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.key;
  
  // Dashboard Referer check: allow direct requests from the dashboard
  const referer = req.headers.referer;
  const isDashboardRequest = referer && (referer.includes('localhost') || referer.includes(req.headers.host));
  
  if (isDashboardRequest) {
    req.apiKey = 'dashboard';
    return next();
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required. Use header "X-API-Key" or query parameter "?key=".' });
  }

  try {
    const authResult = await cache.validateApiKey(apiKey);
    if (!authResult.valid) {
      if (authResult.reason === 'rate_limit_exceeded') {
        return res.status(429).json({ error: 'API key rate limit quota exceeded.' });
      }
      return res.status(401).json({ error: 'Invalid API key.' });
    }
    
    req.apiKey = apiKey;
    next();
  } catch (error) {
    console.error('API Key validation error:', error);
    res.status(500).json({ error: 'Failed to authenticate request.' });
  }
}

/**
 * GET /api/preview
 * Main metadata extraction endpoint (supports custom selectors & API key authorization)
 */
app.get('/api/preview', checkAuth, async (req, res) => {
  const { url, screenshot, refresh, selectors, userAgent } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }

  const normalizedUrl = url.trim();
  const captureScreenshot = screenshot === 'true';
  const forceRefresh = refresh === 'true';

  // Parse custom selectors query if present
  let parsedSelectors = null;
  if (selectors) {
    try {
      if (selectors.startsWith('{')) {
        parsedSelectors = JSON.parse(selectors);
      } else {
        parsedSelectors = {};
        selectors.split(',').forEach(item => {
          const [key, ...selParts] = item.split(':');
          if (key && selParts.length > 0) {
            parsedSelectors[key.trim()] = selParts.join(':').trim();
          }
        });
      }
    } catch (e) {
      console.error('Failed to parse selectors parameter:', e);
    }
  }

  const startTime = Date.now();

  try {
    // 1. Check cache database if not forcing a refresh and no custom selectors requested
    if (!forceRefresh && !parsedSelectors) {
      const cachedData = await cache.getPreview(normalizedUrl);
      if (cachedData) {
        if (!captureScreenshot || cachedData.screenshotUrl) {
          const duration = Date.now() - startTime;
          await cache.logRequest(normalizedUrl, true, duration, req.apiKey);
          
          const responseData = { ...cachedData, cacheHit: true };
          return res.json(responseData);
        }
      }
    }

    // 2. Perform live scrape
    const preview = await scrapeUrl(normalizedUrl, {
      screenshot: captureScreenshot,
      useBrowser: false,
      selectors: parsedSelectors,
      userAgent: userAgent ? userAgent.trim() : null
    });

    // 3. Save to database cache (only if standard scrape, not custom selectors)
    if (!parsedSelectors) {
      const serializedPreview = {
        ...preview,
        rawMeta: JSON.stringify(preview.rawMeta || {})
      };
      await cache.savePreview(serializedPreview);
    }

    const duration = Date.now() - startTime;
    await cache.logRequest(normalizedUrl, false, duration, req.apiKey);

    const responseData = { ...preview, cacheHit: false };

    // 4. Dispatch webhook alerts asynchronously
    const webhooks = await cache.getWebhooks();
    if (webhooks.length > 0) {
      for (const hook of webhooks) {
        webhookManager.dispatch(hook.url, { event: 'preview.created', data: responseData }, hook.secret);
      }
    }

    res.json(responseData);
  } catch (error) {
    const duration = Date.now() - startTime;
    await cache.logRequest(normalizedUrl, false, duration, req.apiKey);
    console.error(`Error scraping URL: ${normalizedUrl}`, error);
    res.status(500).json({ error: error.message || 'An error occurred during URL parsing.' });
  }
});

/**
 * POST /api/preview/batch
 * Bulk URL scraper supporting webhooks
 */
app.post('/api/preview/batch', async (req, res) => {
  const { urls, webhookUrl, screenshot } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'An array of "urls" is required.' });
  }

  if (urls.length > 10) {
    return res.status(400).json({ error: 'Batch processing is capped at 10 URLs per request.' });
  }

  const jobId = 'job_' + Math.random().toString(36).substr(2, 9);
  const captureScreenshot = screenshot === true;

  // Process batch asynchronously in background
  res.json({ jobId, status: 'processing', message: 'Batch queue started.' });

  // Asynchronous background runner
  (async () => {
    const results = [];
    
    for (const url of urls) {
      try {
        const cached = await cache.getPreview(url);
        if (cached && (!captureScreenshot || cached.screenshotUrl)) {
          results.push({ ...cached, cacheHit: true });
          continue;
        }

        const preview = await scrapeUrl(url, { screenshot: captureScreenshot });
        await cache.savePreview({
          ...preview,
          rawMeta: JSON.stringify(preview.rawMeta || {})
        });
        results.push({ ...preview, cacheHit: false });
      } catch (err) {
        results.push({ url, error: err.message || 'Scrape failed' });
      }
    }

    // Dispatch webhook to client
    if (webhookUrl) {
      let secret = null;
      try {
        const webhooks = await cache.getWebhooks();
        const matchedHook = webhooks.find(h => h.url === webhookUrl.trim());
        if (matchedHook) {
          secret = matchedHook.secret;
        }
      } catch (err) {
        console.error('Failed to look up webhook secret for batch:', err);
      }
      webhookManager.dispatch(webhookUrl, { jobId, event: 'batch.completed', data: results }, secret);
    }
  })();
});

/**
 * GET /api/cache
 * Fetch all cache summaries
 */
app.get('/api/cache', async (req, res) => {
  try {
    const list = await cache.getCachedList();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve cache database.' });
  }
});

/**
 * DELETE /api/cache
 * Purge specific URL or entire cache
 */
app.delete('/api/cache', async (req, res) => {
  const { url } = req.query;
  try {
    if (url) {
      const deleted = await cache.deletePreview(url.trim());
      return res.json({ success: deleted, message: deleted ? 'URL removed from cache.' : 'URL not found.' });
    } else {
      const count = await cache.clearCache();
      return res.json({ success: true, message: `Cleared ${count} cached items.` });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to manipulate cache database.' });
  }
});

/**
 * GET /api/analytics
 * Retrieve caching analytics
 */
app.get('/api/analytics', async (req, res) => {
  try {
    const stats = await cache.getAnalytics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute analytics.' });
  }
});

/**
 * GET /api/webhooks/history
 * Retrieve active webhook delivery attempts logs
 */
app.get('/api/webhooks/history', (req, res) => {
  res.json(webhookManager.getHistory());
});

/**
 * POST /api/webhooks/subscribe
 * Add a listener URL for global scraping events
 */
app.post('/api/webhooks/subscribe', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Webhook "url" is required.' });
  
  try {
    const secret = await cache.addWebhook(url.trim());
    res.json({ success: true, message: 'Webhook subscribed successfully.', secret });
  } catch (error) {
    res.status(500).json({ error: 'Failed to subscribe webhook.' });
  }
});

/**
 * GET /api/webhooks
 * List active webhook subscriptions
 */
app.get('/api/webhooks', async (req, res) => {
  try {
    const hooks = await cache.getWebhooks();
    res.json(hooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch webhooks.' });
  }
});

/**
 * DELETE /api/webhooks/unsubscribe
 * Remove a webhook subscriber
 */
app.delete('/api/webhooks/unsubscribe', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Webhook "url" query parameter is required.' });

  try {
    await cache.removeWebhook(url.trim());
    res.json({ success: true, message: 'Webhook unsubscribed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe webhook.' });
  }
});

/**
 * GET /api/feed/explore
 * Explore and parse sitemaps / RSS feeds returning child links
 */
app.get('/api/feed/explore', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }
  try {
    const urls = await exploreFeedUrls(url);
    res.json(urls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/preview/pdf
 * Generate printable reader-view PDF of the web page article
 */
app.get('/api/preview/pdf', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL parameter is required.' });
  
  const normalizedUrl = url.trim();

  try {
    let preview = await cache.getPreview(normalizedUrl);
    if (!preview || !preview.readabilityHtml) {
      preview = await scrapeUrl(normalizedUrl, { screenshot: false });
    }

    if (!preview.readabilityHtml) {
      return res.status(400).json({ error: 'This webpage does not support readability extraction (no readable body elements found).' });
    }

    const pdfBuffer = await generatePdf(preview.readabilityHtml, preview.title, preview.author);

    const filename = (preview.title || 'article')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 50) + '.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    res.status(500).json({ error: error.message || 'Failed to render PDF document.' });
  }
});

/**
 * GET /api/keys
 * Fetch all registered developer API keys
 */
app.get('/api/keys', async (req, res) => {
  try {
    const keys = await cache.getApiKeys();
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys.' });
  }
});

/**
 * POST /api/keys
 * Generate a new developer API key
 */
app.post('/api/keys', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Key "name" parameter is required.' });

  try {
    const newKey = await cache.generateApiKey(name.trim());
    res.status(201).json({ success: true, apiKey: newKey });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate API key.' });
  }
});

/**
 * DELETE /api/keys
 * Revoke an existing developer API key
 */
app.delete('/api/keys', async (req, res) => {
  const { apiKey } = req.query;
  if (!apiKey) return res.status(400).json({ error: 'API key query parameter "apiKey" is required.' });

  try {
    const deleted = await cache.revokeApiKey(apiKey.trim());
    res.json({ success: deleted, message: deleted ? 'API key revoked.' : 'API key not found.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key.' });
  }
});

/**
 * GET /api/proxy
 * Secure CORS proxy endpoint to stream external images bypassing CORS policies
 */
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL parameter is required.' });

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*'
      }
    });

    const contentType = response.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    res.setHeader('Cache-Control', 'public, max-age=604800');
    response.data.pipe(res);
  } catch (error) {
    console.error(`Failed to proxy image: ${url}`, error.message);
    res.status(500).json({ error: 'Failed to retrieve proxied image resource.' });
  }
});

// Fallback HTML router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`URL Preview Service Server started on http://localhost:${PORT}`);
});

export default app;
