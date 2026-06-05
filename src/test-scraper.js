import { scrapeUrl } from './scraper.js';

async function runTest() {
  const url = 'https://example.com';
  console.log(`Running scraping engine tests on: ${url}`);
  
  try {
    const data = await scrapeUrl(url, { screenshot: false });
    
    console.log('\n--- Extraction Results ---');
    console.log('URL:          ', data.url);
    console.log('Resolved URL: ', data.resolvedUrl);
    console.log('Title:        ', data.title);
    console.log('Description:  ', data.description);
    console.log('Site Name:    ', data.siteName);
    console.log('Favicon:      ', data.favicon);
    console.log('ContentType:  ', data.contentType);
    console.log('Color:        ', data.dominantColor);
    console.log('Method Used:  ', data.method);
    console.log('Duration:     ', data.duration, 'ms');
    
    if (data.title === 'Example Domain') {
      console.log('\n✅ Scraper validation check PASSED!');
    } else {
      console.warn('\n⚠️ Scraper check returned unexpected title: ', data.title);
    }
  } catch (error) {
    console.error('\n❌ Test FAILED with error:', error);
  }
}

runTest();
