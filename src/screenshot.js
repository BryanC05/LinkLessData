import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_SCREENSHOTS_DIR = path.join(__dirname, '../public/screenshots');

if (!fs.existsSync(PUBLIC_SCREENSHOTS_DIR)) {
  fs.mkdirSync(PUBLIC_SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Capture a screenshot of the given URL
 * @param {string} url - Target URL to screenshot
 * @returns {Promise<string|null>} Relative URL path of the captured screenshot (e.g. "/screenshots/abcdef.png")
 */
export async function captureScreenshot(url) {
  let browser = null;
  try {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const filename = `${hash}.png`;
    const outputPath = path.join(PUBLIC_SCREENSHOTS_DIR, filename);

    // Launch headless Chromium
    browser = await chromium.launch({
      headless: true
    });

    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1
    });

    const page = await context.newPage();
    
    // Set timeout to 15 seconds
    page.setDefaultTimeout(15000);
    
    // Go to URL and wait until the DOM is loaded
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Wait a brief moment for dynamic animations or images to settle
    await page.waitForTimeout(1000);
    
    // Take the screenshot
    await page.screenshot({ path: outputPath, type: 'png' });

    // Clean up
    await browser.close();
    
    return `/screenshots/${filename}`;
  } catch (error) {
    console.error(`Failed to capture screenshot for URL: ${url}`, error);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        // Ignore close error
      }
    }
    return null;
  }
}

/**
 * Render HTML readability content to PDF using Playwright
 * @param {string} articleHtml - Cleansed HTML of article
 * @param {string} title - Title of the article
 * @param {string} author - Author of the article
 * @returns {Promise<Buffer>} PDF Buffer
 */
export async function generatePdf(articleHtml, title, author) {
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title || 'Article Printout'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Lora', serif;
            color: #1e293b;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 3rem 2rem;
          }
          h1 {
            font-family: 'Inter', sans-serif;
            font-size: 2.25rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 0.5rem;
          }
          .meta {
            font-family: 'Inter', sans-serif;
            font-size: 0.9rem;
            color: #64748b;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #e2e8f0;
          }
          p {
            margin-bottom: 1.5rem;
            font-size: 1.1rem;
          }
          img {
            max-width: 100%;
            border-radius: 6px;
            margin: 1.5rem 0;
          }
          blockquote {
            border-left: 4px solid #5c6bc0;
            padding-left: 1rem;
            font-style: italic;
            color: #475569;
            margin: 1.5rem 0;
          }
          pre, code {
            font-family: monospace;
            background-color: #f1f5f9;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-size: 0.9rem;
          }
          pre {
            padding: 1rem;
            overflow-x: auto;
            margin: 1.5rem 0;
          }
        </style>
      </head>
      <body>
        <h1>${title || 'Untitled Article'}</h1>
        <div class="meta">
          ${author ? `By ${author} &nbsp;•&nbsp; ` : ''}
          Printed via LinkLessData URL Scraper
        </div>
        <div>
          ${articleHtml}
        </div>
      </body>
      </html>
    `;

    await page.setContent(content);
    await page.waitForLoadState('networkidle');
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      printBackground: true
    });
    
    await browser.close();
    return pdfBuffer;
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    if (browser) await browser.close();
    throw error;
  }
}
