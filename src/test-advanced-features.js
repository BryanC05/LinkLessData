import assert from 'assert';
import crypto from 'crypto';
import express from 'express';
import axios from 'axios';
import { exploreFeedUrls } from './feed.js';
import { webhookManager } from './webhook.js';
import { extractMetadataFromHtml, scrapeUrl } from './scraper.js';

async function runTests() {
  console.log('=== Starting Advanced Features Verification Tests ===\n');

  // 1. Setup a local mock web server to receive webhooks and serve mock pages
  const app = express();
  app.use(express.json());
  
  let lastWebhookReceived = null;
  let serverUserAgent = null;

  // Webhook listener endpoint
  app.post('/mock-webhook', (req, res) => {
    lastWebhookReceived = {
      headers: req.headers,
      body: req.body
    };
    res.status(200).send('OK');
  });

  // Page serving endpoint to test User-Agent and JSON-LD
  app.get('/mock-page', (req, res) => {
    serverUserAgent = req.headers['user-agent'];
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page Title</title>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": "Structured Data Test Headline",
            "datePublished": "2026-06-01T12:00:00Z",
            "author": {
              "@type": "Person",
              "name": "Jane Doe"
            }
          }
        </script>
      </head>
      <body>
        <h1>Main Page Title</h1>
        <p>This is a test paragraph for readability parsing.</p>
      </body>
      </html>
    `);
  });

  // Mock endpoint for feed / sitemap exploration
  app.get('/mock-sitemap.xml', (req, res) => {
    res.set('Content-Type', 'application/xml');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
         <url>
            <loc>https://example.com/page-1</loc>
            <lastmod>2026-06-01</lastmod>
         </url>
         <url>
            <loc>https://example.com/page-2</loc>
         </url>
      </urlset>
    `);
  });

  app.get('/mock-rss.xml', (req, res) => {
    res.set('Content-Type', 'application/xml');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8" ?>
      <rss version="2.0">
      <channel>
        <title>Mock RSS Feed</title>
        <link>https://example.com</link>
        <item>
          <title>RSS Article Title 1</title>
          <link>https://example.com/rss-1</link>
          <description>Description of article 1</description>
        </item>
        <item>
          <title>RSS Article Title 2</title>
          <link>https://example.com/rss-2</link>
        </item>
      </channel>
      </rss>
    `);
  });

  const server = app.listen(4000);
  console.log('Started mock local server on port 4000');

  try {
    // --- Test 1: Sitemap and RSS Explorer ---
    console.log('\n--- Test 1: Sitemap & RSS Explorer ---');
    const sitemapUrls = await exploreFeedUrls('http://localhost:4000/mock-sitemap.xml');
    console.log('Sitemap exploration returned:', sitemapUrls);
    assert.strictEqual(sitemapUrls.length, 2);
    assert.strictEqual(sitemapUrls[0].url, 'https://example.com/page-1');
    assert.strictEqual(sitemapUrls[1].url, 'https://example.com/page-2');
    console.log('✅ Sitemap exploration test passed.');

    const rssUrls = await exploreFeedUrls('http://localhost:4000/mock-rss.xml');
    console.log('RSS exploration returned:', rssUrls);
    assert.strictEqual(rssUrls.length, 2);
    assert.strictEqual(rssUrls[0].url, 'https://example.com/rss-1');
    assert.strictEqual(rssUrls[0].title, 'RSS Article Title 1');
    console.log('✅ RSS exploration test passed.');

    // --- Test 2: User-Agent Custom selector inside Crawl ---
    console.log('\n--- Test 2: Custom User-Agent Header ---');
    const customUa = 'Custom-Googlebot-Test-UA/2.0';
    const crawlData = await scrapeUrl('http://localhost:4000/mock-page', {
      userAgent: customUa
    });
    console.log('Scrape result status: success. Scraped UA at Server:', serverUserAgent);
    assert.strictEqual(serverUserAgent, customUa);
    console.log('✅ Custom User-Agent test passed.');

    // --- Test 3: JSON-LD Structured Data Schema Inspector ---
    console.log('\n--- Test 3: JSON-LD Structured Data Schema Inspector ---');
    console.log('JSON-LD records parsed:', crawlData.jsonLd);
    assert.ok(Array.isArray(crawlData.jsonLd));
    assert.strictEqual(crawlData.jsonLd.length, 1);
    assert.strictEqual(crawlData.jsonLd[0]['@type'], 'NewsArticle');
    assert.strictEqual(crawlData.jsonLd[0].headline, 'Structured Data Test Headline');
    console.log('✅ JSON-LD Parsing test passed.');

    // --- Test 4: HMAC-SHA256 Webhook Signature ---
    console.log('\n--- Test 4: Webhook Signature Sign/Verify ---');
    const secret = 'whsec_my_super_secret_test_token_123';
    const payload = {
      event: 'preview.created',
      data: {
        url: 'https://example.com',
        title: 'Example Title'
      }
    };

    // Calculate signature locally
    const localSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Send payload using webhookManager
    await webhookManager.dispatch('http://localhost:4000/mock-webhook', payload, secret);

    // Wait a brief moment for the async dispatch
    await new Promise(resolve => setTimeout(resolve, 500));

    assert.ok(lastWebhookReceived, 'Webhook was not received at endpoint');
    const signatureHeader = lastWebhookReceived.headers['x-linkless-signature'];
    const timestampHeader = lastWebhookReceived.headers['x-linkless-timestamp'];

    console.log('Received Webhook Headers:', lastWebhookReceived.headers);
    console.log('Expected signature header format:', `sha256=${localSignature}`);
    console.log('Actual signature header received:', signatureHeader);

    assert.strictEqual(signatureHeader, `sha256=${localSignature}`);
    assert.ok(timestampHeader, 'Timestamp header missing');
    console.log('✅ Webhook HMAC-SHA256 verification test passed.');

    console.log('\n======================================================');
    console.log('🎉 ALL ADVANCED FEATURE TESTS COMPLETED SUCCESSFULLY!');
    console.log('======================================================');

  } catch (error) {
    console.error('\n❌ Test execution failed with error:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

runTests();
