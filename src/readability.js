import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

/**
 * Extracts readable article content from HTML markup
 * @param {string} html - Raw HTML source code
 * @param {string} url - Base URL for resolving links
 * @returns {object} Readable content, excerpt, and estimated reading time
 */
export function extractReadability(html, url) {
  const fallback = {
    text: '',
    html: '',
    excerpt: '',
    readingTime: 0
  };

  if (!html) return fallback;

  try {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Run Mozilla Readability parser
    const reader = new Readability(doc);
    const article = reader.parse();

    if (article) {
      const text = article.textContent ? article.textContent.trim() : '';
      const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
      const readingTime = Math.max(1, Math.ceil(wordCount / 225)); // Estimate 225 words per minute

      return {
        text,
        html: article.content || '',
        excerpt: article.excerpt || '',
        readingTime
      };
    }
  } catch (error) {
    console.error('Error during readability extraction:', error);
  }

  return fallback;
}
