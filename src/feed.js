import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Fetch and extract URLs from a Sitemap, RSS feed, or Atom feed
 * @param {string} feedUrl - Target sitemap or RSS URL
 * @returns {Promise<Array<{url: string, title: string}>>} List of resolved URLs
 */
export async function exploreFeedUrls(feedUrl) {
  let targetUrl = feedUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/xml, application/xml, application/rss+xml, application/atom+xml, text/html, */*'
      },
      timeout: 10000
    });

    const xml = response.data;
    if (!xml || typeof xml !== 'string') {
      throw new Error('Invalid feed content returned.');
    }

    const $ = cheerio.load(xml, { xmlMode: true });
    const results = [];

    // 1. Detect sitemap structure
    const isSitemap = $('urlset').length > 0 || $('sitemapindex').length > 0 || xml.includes('<urlset') || xml.includes('<sitemapindex');
    
    if (isSitemap) {
      // Collect links from <loc>
      $('loc').each((i, el) => {
        const url = $(el).text().trim();
        if (url) {
          // Extract a friendly name from URL path
          let title = '';
          try {
            const parsed = new URL(url);
            title = parsed.pathname !== '/' ? parsed.pathname : parsed.hostname;
          } catch (e) {
            title = url;
          }
          results.push({ url, title });
        }
      });
      return results;
    }

    // 2. Detect RSS structure
    const isRss = $('rss').length > 0 || $('channel').length > 0;
    if (isRss) {
      $('item').each((i, el) => {
        const title = $(el).find('title').first().text().trim() || 'Untitled Feed Item';
        let url = $(el).find('link').first().text().trim();
        
        if (!url) {
          // Fallback if link is attribute or different namespace
          url = $(el).find('guid').text().trim();
        }
        
        if (url && /^https?:\/\//i.test(url)) {
          results.push({ url, title });
        }
      });
      return results;
    }

    // 3. Detect Atom structure
    const isAtom = $('feed').length > 0;
    if (isAtom) {
      $('entry').each((i, el) => {
        const title = $(el).find('title').first().text().trim() || 'Untitled Feed Entry';
        let url = $(el).find('link[rel="alternate"]').attr('href') || $(el).find('link').first().attr('href') || $(el).find('id').text().trim();
        
        if (url && /^https?:\/\//i.test(url)) {
          results.push({ url, title });
        }
      });
      return results;
    }

    // Fallback: search for any href or URL links in the raw page
    $('a').each((i, el) => {
      const url = $(el).attr('href');
      const title = $(el).text().trim() || 'Link';
      if (url && /^https?:\/\//i.test(url)) {
        results.push({ url, title });
      }
    });

    return results;
  } catch (error) {
    console.error(`Feed exploration failed for: ${feedUrl}`, error.message);
    throw new Error(`Failed to parse sitemap/feed: ${error.message}`);
  }
}
