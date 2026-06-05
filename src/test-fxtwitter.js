import axios from 'axios';
import * as cheerio from 'cheerio';

async function testFxHtml() {
  const tweetUrl = 'https://vxtwitter.com/jack/status/20';
  console.log(`Fetching HTML from: ${tweetUrl} with Discordbot UA`);
  
  try {
    const res = await axios.get(tweetUrl, {
      headers: {
        'User-Agent': 'Discordbot/2.0'
      },
      timeout: 8000
    });
    
    console.log(`Success! Status code: ${res.status}`);
    const $ = cheerio.load(res.data);
    
    console.log('\n--- EXTRACTED META TAGS ---');
    $('meta').each((i, el) => {
      const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('itemprop');
      const content = $(el).attr('content');
      if (name && content) {
        console.log(`${name}: ${content}`);
      }
    });

  } catch (err) {
    console.error('Failed to parse:', err.message);
  }
}

testFxHtml();
