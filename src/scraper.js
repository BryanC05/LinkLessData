import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { URL } from 'url';
import { getDominantColor } from './color.js';
import { extractReadability } from './readability.js';
import { captureScreenshot } from './screenshot.js';

/**
 * Resolves a relative URL against a base URL
 */
function resolveUrl(base, relative) {
  if (!relative) return null;
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return relative;
  }
}

/**
 * Checks if the html signature matches a typical single page application (SPA)
 */
function checkIfSPA(html) {
  if (!html || typeof html !== 'string') return true;
  
  const lowerHtml = html.toLowerCase();
  const containsAppDiv = lowerHtml.includes('id="app"') || 
                          lowerHtml.includes('id="root"') || 
                          lowerHtml.includes('id="__next"') ||
                          lowerHtml.includes('id="__layout"');
  
  // If HTML contains a mounting div and has very short content (mostly scripts)
  if (containsAppDiv && html.length < 10000) {
    return true;
  }
  return false;
}

/**
 * Extracts metadata fields from raw HTML content
 */
export function extractMetadataFromHtml(html, targetUrl, selectors = null) {
  const $ = cheerio.load(html);
  const metadata = {
    title: '',
    description: '',
    image: '',
    favicon: '',
    siteName: '',
    author: '',
    publishedDate: '',
    contentType: 'website',
    rawMeta: {}
  };

  // Build raw meta dictionary for inspection
  $('meta').each((i, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('itemprop');
    const content = $(el).attr('content');
    if (name && content) {
      metadata.rawMeta[name] = content;
    }
  });

  // 1. JSON-LD parsing
  let jsonLdData = {};
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const parsed = JSON.parse($(el).html() || '');
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item) continue;
        jsonLd.push(item);
        const type = item['@type'];
        if (type === 'Article' || type === 'NewsArticle' || type === 'BlogPosting' || type === 'WebPage') {
          jsonLdData = { ...jsonLdData, ...item };
        } else if (!jsonLdData['@type']) {
          jsonLdData = { ...jsonLdData, ...item };
        }
      }
    } catch (e) {
      // Suppress JSON-LD parsing errors
    }
  });
  metadata.jsonLd = jsonLd;

  const getMeta = (names) => {
    for (const name of names) {
      if (metadata.rawMeta[name]) return metadata.rawMeta[name];
    }
    return '';
  };

  // Title
  metadata.title = getMeta(['og:title', 'twitter:title']) 
    || jsonLdData.headline 
    || jsonLdData.name 
    || $('title').first().text() 
    || $('h1').first().text() 
    || '';
  metadata.title = metadata.title.replace(/\s+/g, ' ').trim();

  // Description
  metadata.description = getMeta(['og:description', 'twitter:description', 'description']) 
    || jsonLdData.description 
    || '';
  
  if (!metadata.description) {
    const paragraphs = [];
    $('p').slice(0, 3).each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 20) paragraphs.push(text);
    });
    metadata.description = paragraphs.join(' ');
  }
  metadata.description = metadata.description.replace(/\s+/g, ' ').trim();

  // Image
  let rawImage = getMeta(['og:image', 'twitter:image', 'image'])
    || (jsonLdData.image ? (typeof jsonLdData.image === 'string' ? jsonLdData.image : jsonLdData.image.url) : '')
    || $('link[rel="image_src"]').attr('href')
    || '';
  
  if (!rawImage) {
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar') && !src.startsWith('data:')) {
        rawImage = src;
        return false; // break
      }
    });
  }
  metadata.image = resolveUrl(targetUrl, rawImage);

  // Favicon
  let rawFavicon = $('link[rel="apple-touch-icon"]').attr('href')
    || $('link[rel*="icon"]').attr('href')
    || '';
  
  if (!rawFavicon) {
    try {
      const parsedUrl = new URL(targetUrl);
      rawFavicon = `${parsedUrl.origin}/favicon.ico`;
    } catch (e) {
      // Ignored
    }
  }
  metadata.favicon = resolveUrl(targetUrl, rawFavicon);

  // Site Name
  metadata.siteName = getMeta(['og:site_name', 'application-name']) 
    || (jsonLdData.publisher ? jsonLdData.publisher.name : '')
    || '';
  
  if (!metadata.siteName) {
    try {
      const parsedUrl = new URL(targetUrl);
      metadata.siteName = parsedUrl.hostname.replace('www.', '');
    } catch (e) {
      // Ignored
    }
  }

  // Author
  metadata.author = getMeta(['article:author', 'og:article:author', 'twitter:creator', 'author'])
    || (jsonLdData.author ? (typeof jsonLdData.author === 'string' ? jsonLdData.author : jsonLdData.author.name) : '')
    || '';

  // Published Date
  metadata.publishedDate = getMeta(['article:published_time', 'og:article:published_time', 'date', 'pubdate'])
    || jsonLdData.datePublished
    || jsonLdData.dateCreated
    || '';

  // Content Type
  metadata.contentType = getMeta(['og:type']) 
    || (jsonLdData['@type'] ? jsonLdData['@type'].toLowerCase() : 'website');

  // RSS & sitemap autodiscover
  const feeds = [];
  $('link[type="application/rss+xml"]').each((i, el) => {
    const href = $(el).attr('href');
    if (href) feeds.push(resolveUrl(targetUrl, href));
  });
  $('link[type="application/atom+xml"]').each((i, el) => {
    const href = $(el).attr('href');
    if (href) feeds.push(resolveUrl(targetUrl, href));
  });
  $('link[rel="sitemap"]').each((i, el) => {
    const href = $(el).attr('href');
    if (href) feeds.push(resolveUrl(targetUrl, href));
  });
  metadata.feeds = feeds;

  // Custom selector extraction
  const customFields = {};
  if (selectors && typeof selectors === 'object') {
    for (const [key, selector] of Object.entries(selectors)) {
      try {
        customFields[key] = $(selector).text().trim() || null;
      } catch (e) {
        customFields[key] = null;
      }
    }
  }
  metadata.customFields = customFields;

  return metadata;
}

/**
 * Runs a full browser page load to scrape dynamic pages
 */
async function runBrowserCrawl(url, userAgent = null) {
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Wait for JS to run for 2 seconds
    await page.waitForTimeout(2000);

    const finalUrl = page.url();
    const html = await page.content();
    const headers = response ? await response.headers() : {};
    
    await browser.close();
    return { html, url: finalUrl, headers };
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        // Ignored
      }
    }
    throw error;
  }
}

/**
 * Primary public scraping function
 */
export async function scrapeUrl(url, options = {}) {
  const { screenshot = false, useBrowser = false, userAgent = null } = options;
  
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  const startTime = Date.now();

  const twitterStatusRegex = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)/i;
  const match = targetUrl.match(twitterStatusRegex);
  
  if (match) {
    const username = match[1];
    const tweetId = match[2];
    
    // 1. Try FXTwitter JSON API
    try {
      const apiResponse = await axios.get(`https://api.fxtwitter.com/${username}/status/${tweetId}`, {
        headers: { 'User-Agent': 'LinkLessData-Scraper/1.0' },
        timeout: 8000
      });
      if (apiResponse.data && apiResponse.data.tweet) {
        const tweet = apiResponse.data.tweet;
        const text = tweet.text || '';
        const authorName = tweet.author?.name || username;
        const screenName = tweet.author?.screen_name || username;
        
        let previewImage = '';
        if (tweet.media?.photos && tweet.media.photos.length > 0) {
          previewImage = tweet.media.photos[0].url;
        } else if (tweet.media?.all && tweet.media.all.length > 0) {
          previewImage = tweet.media.all[0].url;
        } else if (tweet.author?.avatar_url) {
          previewImage = tweet.author.avatar_url;
        }
        
        const publishedDate = tweet.created_timestamp 
          ? new Date(tweet.created_timestamp * 1000).toISOString() 
          : tweet.created_at || '';

        const result = {
          url: targetUrl,
          resolvedUrl: targetUrl,
          title: `${authorName} (@${screenName}) on X`,
          description: text,
          image: previewImage,
          favicon: 'https://abs.twimg.com/favicons/twitter.3.ico',
          siteName: 'X (Twitter)',
          author: `${authorName} (@${screenName})`,
          publishedDate,
          contentType: 'tweet',
          dominantColor: '#1DA1F2', // X blue
          screenshotUrl: null,
          readabilityText: text,
          readabilityHtml: `<p>${text}</p>`,
          readingTime: 1,
          rawMeta: {
            'og:title': `${authorName} (@${screenName}) on X`,
            'og:description': text,
            'og:image': previewImage,
            'og:site_name': 'X',
            'twitter:card': 'summary_large_image',
            'likes_count': tweet.likes || 0,
            'retweets_count': tweet.retweets || 0
          },
          techStack: ['X.com API', 'JSON REST'],
          seo: { score: 100, checklist: [] },
          feeds: [],
          duration: Date.now() - startTime,
          method: 'FXTwitter API'
        };

        if (screenshot) {
          try {
            result.screenshotUrl = await captureScreenshot(`https://fxtwitter.com/${username}/status/${tweetId}`);
          } catch (e) {
            console.error('Failed to capture FXTwitter screenshot', e);
          }
        }

        return result;
      }
    } catch (apiError) {
      console.warn(`FXTwitter API failed for status ${tweetId}, trying HTML crawl fallback via fxtwitter.com...`, apiError.message);
      
      // Fallback 2: Crawl fxtwitter.com HTML page with Discordbot User-Agent
      try {
        const crawlUrl = `https://fxtwitter.com/${username}/status/${tweetId}`;
        const response = await axios.get(crawlUrl, {
          headers: {
            'User-Agent': 'Discordbot/2.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          },
          timeout: 8000
        });
        const html = response.data;
        const metadata = extractMetadataFromHtml(html, targetUrl);
        
        if (metadata.description && metadata.description.includes("doesn't exist")) {
          throw new Error('This tweet does not exist or has been deleted.');
        }

        let dominantColor = '#1DA1F2';
        if (metadata.image) {
          dominantColor = await getDominantColor(metadata.image);
        }
        
        const readability = extractReadability(html, targetUrl);
        
        let screenshotUrl = null;
        if (screenshot) {
          screenshotUrl = await captureScreenshot(crawlUrl);
        }

        return {
          url: targetUrl,
          resolvedUrl: targetUrl,
          title: metadata.title || `${username} on X`,
          description: metadata.description || '',
          image: metadata.image || '',
          favicon: 'https://abs.twimg.com/favicons/twitter.3.ico',
          siteName: metadata.siteName || 'X (Twitter)',
          author: metadata.author || username,
          publishedDate: metadata.publishedDate || '',
          contentType: 'tweet',
          dominantColor,
          screenshotUrl,
          readabilityText: readability.text,
          readabilityHtml: readability.html,
          readingTime: readability.readingTime,
          rawMeta: metadata.rawMeta,
          techStack: ['X.com Front-End Proxy', 'fxtwitter.com'],
          seo: { score: 100, checklist: [] },
          feeds: [],
          duration: Date.now() - startTime,
          method: 'FXTwitter HTML Crawl'
        };
      } catch (htmlCrawlError) {
        console.error(`FXTwitter HTML crawl fallback also failed:`, htmlCrawlError.message);
        throw new Error(htmlCrawlError.message.includes("does not exist") 
          ? "This tweet status does not exist (404 on Twitter/X)."
          : `Failed to scrape X Status: ${htmlCrawlError.message}`
        );
      }
    }
  }

  // Intercept other general Twitter/X URLs (like profiles e.g. https://x.com/elonmusk)
  let fetchUrl = targetUrl;
  let isTwitter = false;
  if (/(?:x|twitter)\.com/i.test(targetUrl)) {
    fetchUrl = targetUrl.replace(/(?:x|twitter)\.com/i, 'vxtwitter.com');
    isTwitter = true;
  }

  let html = '';
  let finalUrl = targetUrl;
  let method = 'HTTP';
  let responseHeaders = {};

  if (useBrowser) {
    const crawl = await runBrowserCrawl(fetchUrl, userAgent);
    html = crawl.html;
    finalUrl = crawl.url;
    responseHeaders = crawl.headers || {};
    method = 'Browser';
  } else {
    try {
      const headers = {
        'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      };

      if (isTwitter) {
        headers['User-Agent'] = 'Discordbot/2.0';
      }

      const response = await axios.get(fetchUrl, {
        headers,
        timeout: 8000,
        maxRedirects: 5
      });
      
      html = response.data;
      finalUrl = response.request?.res?.responseUrl || response.config?.url || targetUrl;
      responseHeaders = response.headers || {};

      if (!isTwitter && checkIfSPA(html)) {
        console.log(`Detecting SPA for ${targetUrl}. Re-fetching with Playwright...`);
        const crawl = await runBrowserCrawl(fetchUrl, userAgent);
        html = crawl.html;
        finalUrl = crawl.url;
        responseHeaders = crawl.headers || {};
        method = 'Browser';
      }
    } catch (error) {
      console.warn(`HTTP request failed for ${targetUrl}. Trying Playwright:`, error.message);
      try {
        const crawl = await runBrowserCrawl(fetchUrl, userAgent);
        html = crawl.html;
        finalUrl = crawl.url;
        responseHeaders = crawl.headers || {};
        method = 'Browser';
      } catch (browserError) {
        console.error(`Browser scrape fallback failed:`, browserError.message);
        throw new Error(`Failed to download page content: ${error.message}`);
      }
    }
  }

  // Restore domain name if it was rewritten
  let cleanFinalUrl = finalUrl;
  if (/vxtwitter\.com/i.test(finalUrl)) {
    cleanFinalUrl = finalUrl.replace(/vxtwitter\.com/i, 'x.com');
  }

  const { selectors = null } = options;
  // Parse HTML for metadata
  const metadata = extractMetadataFromHtml(html, cleanFinalUrl, selectors);

  // Dominant color extraction
  let dominantColor = '#5C6BC0';
  if (metadata.image) {
    dominantColor = await getDominantColor(metadata.image);
  } else if (metadata.favicon) {
    dominantColor = await getDominantColor(metadata.favicon);
  }

  // Article readability parsing
  const readability = extractReadability(html, cleanFinalUrl);

  // Screenshot capture
  let screenshotUrl = null;
  if (screenshot) {
    screenshotUrl = await captureScreenshot(fetchUrl); // capture the proxy version
  }

  const duration = Date.now() - startTime;

  return {
    url: targetUrl,
    resolvedUrl: cleanFinalUrl,
    title: metadata.title,
    description: metadata.description,
    image: metadata.image,
    favicon: metadata.favicon,
    siteName: metadata.siteName,
    author: metadata.author,
    publishedDate: metadata.publishedDate,
    contentType: metadata.contentType,
    dominantColor,
    screenshotUrl,
    readabilityText: readability.text,
    readabilityHtml: readability.html,
    readingTime: readability.readingTime,
    rawMeta: metadata.rawMeta,
    jsonLd: metadata.jsonLd || [],
    customFields: metadata.customFields || {},
    techStack: detectTechStack(html, responseHeaders),
    seo: runSeoAudit(html, cleanFinalUrl),
    feeds: metadata.feeds || [],
    duration,
    method
  };
}

/**
 * Scan script signatures, headers, and meta tags to identify frameworks/platforms
 */
function detectTechStack(html, headers) {
  const tech = [];
  const lowerHtml = html.toLowerCase();
  
  const generatorMatch = html.match(/<meta\s+name="generator"\s+content="([^"]+)"/i);
  if (generatorMatch) {
    tech.push(generatorMatch[1]);
  }

  if (lowerHtml.includes('_next/static') || lowerHtml.includes('id="__next"')) {
    tech.push('Next.js');
  }
  if (lowerHtml.includes('wp-content') || lowerHtml.includes('wp-includes')) {
    if (!tech.some(t => t.toLowerCase().includes('wordpress'))) tech.push('WordPress');
  }
  if (lowerHtml.includes('cdn.shopify.com')) {
    tech.push('Shopify');
  }
  if (lowerHtml.includes('webflow.com') || lowerHtml.includes('data-wf-page')) {
    tech.push('Webflow');
  }
  if (lowerHtml.includes('gatsby-app') || lowerHtml.includes('id="___gatsby"')) {
    tech.push('Gatsby');
  }
  if (lowerHtml.includes('_nuxt/')) {
    tech.push('Nuxt.js');
  }
  if (lowerHtml.includes('react-dom') || lowerHtml.includes('react.production')) {
    if (!tech.includes('React')) tech.push('React');
  }
  if (lowerHtml.includes('vue.global') || lowerHtml.includes('vue.production')) {
    if (!tech.includes('Vue')) tech.push('Vue');
  }
  if (lowerHtml.includes('angular.js') || lowerHtml.includes('ng-app')) {
    tech.push('Angular');
  }
  if (lowerHtml.includes('hugo')) {
    if (!tech.some(t => t.toLowerCase().includes('hugo'))) tech.push('Hugo');
  }

  if (headers && typeof headers === 'object') {
    const server = (headers['server'] || '').toLowerCase();
    const poweredBy = (headers['x-powered-by'] || '').toLowerCase();
    
    if (server.includes('cloudflare')) tech.push('Cloudflare CDN');
    if (server.includes('vercel')) tech.push('Vercel Hosting');
    if (server.includes('netlify')) tech.push('Netlify Hosting');
    if (server.includes('nginx')) tech.push('Nginx Server');
    if (server.includes('apache')) tech.push('Apache Server');
    
    if (poweredBy.includes('express')) tech.push('Express (Node.js)');
    if (poweredBy.includes('php')) tech.push('PHP Backend');
    if (poweredBy.includes('asp.net')) tech.push('ASP.NET');
  }

  return [...new Set(tech)];
}

/**
 * Perform a standard, quantitative SEO check on parsed HTML tags
 */
function runSeoAudit(html, url) {
  const $ = cheerio.load(html);
  const checklist = [];
  let score = 100;

  // 1. Title Audit
  const titleText = $('title').first().text().trim();
  if (!titleText) {
    score -= 15;
    checklist.push({ rule: 'Title Tag', status: 'fail', points: -15, desc: 'Missing <title> tag entirely.' });
  } else if (titleText.length < 30 || titleText.length > 60) {
    score -= 5;
    checklist.push({ rule: 'Title Length', status: 'warning', points: -5, desc: `Title length (${titleText.length} chars) is outside optimal 30-60 character range.` });
  } else {
    checklist.push({ rule: 'Title Quality', status: 'pass', points: 0, desc: `Optimal title length (${titleText.length} chars).` });
  }

  // 2. Description Audit
  const desc = $('meta[name="description"]').attr('content') || '';
  if (!desc) {
    score -= 15;
    checklist.push({ rule: 'Meta Description', status: 'fail', points: -15, desc: 'Missing meta description tag.' });
  } else if (desc.length < 100 || desc.length > 160) {
    score -= 5;
    checklist.push({ rule: 'Description Length', status: 'warning', points: -5, desc: `Description length (${desc.length} chars) is outside optimal 100-160 character range.` });
  } else {
    checklist.push({ rule: 'Description Quality', status: 'pass', points: 0, desc: `Optimal description length (${desc.length} chars).` });
  }

  // 3. Heading Hierarchy (H1 check)
  const h1Count = $('h1').length;
  if (h1Count === 0) {
    score -= 15;
    checklist.push({ rule: 'H1 Header', status: 'fail', points: -15, desc: 'No H1 headers found. Pages should have exactly one H1 header.' });
  } else if (h1Count > 1) {
    score -= 10;
    checklist.push({ rule: 'H1 Count', status: 'warning', points: -10, desc: `Multiple H1 tags (${h1Count}) detected. Recommended limit is one H1 tag per page.` });
  } else {
    checklist.push({ rule: 'H1 Tag', status: 'pass', points: 0, desc: 'Exactly one H1 header detected.' });
  }

  // 4. Image Alt Attribute Check
  const images = $('img');
  let missingAlt = 0;
  images.each((i, el) => {
    const alt = $(el).attr('alt');
    if (!alt || alt.trim() === '') {
      missingAlt++;
    }
  });

  if (images.length > 0) {
    const missingRatio = missingAlt / images.length;
    if (missingRatio > 0) {
      const penalty = Math.round(missingRatio * 20);
      score -= penalty;
      checklist.push({ rule: 'Image Alt Tags', status: 'warning', points: -penalty, desc: `${missingAlt} out of ${images.length} images are missing alternative "alt" text attributes.` });
    } else {
      checklist.push({ rule: 'Image Alt Tags', status: 'pass', points: 0, desc: 'All images contain alt text attributes.' });
    }
  } else {
    checklist.push({ rule: 'Image Alt Tags', status: 'pass', points: 0, desc: 'No images found on page to audit.' });
  }

  // 5. Canonical link audit
  const canonical = $('link[rel="canonical"]').attr('href');
  if (!canonical) {
    score -= 15;
    checklist.push({ rule: 'Canonical URL', status: 'fail', points: -15, desc: 'No canonical link tag found. Prevent duplicate content indexing.' });
  } else {
    checklist.push({ rule: 'Canonical URL', status: 'pass', points: 0, desc: `Canonical URL configured correctly: ${canonical}` });
  }

  return { score: Math.max(0, score), checklist };
}
