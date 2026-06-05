import { scrapeUrl } from './scraper.js';

async function testX() {
  const url = 'https://x.com/jack/status/20';
  console.log(`Scraping X URL: ${url}`);
  
  try {
    const data = await scrapeUrl(url, { screenshot: false });
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error during scrape:', err);
  }
}

testX();
