import axios from 'axios';

async function checkDomains() {
  const tweetPath = 'NASA/status/1792601777017684078';
  
  const urls = [
    `https://api.vxtwitter.com/${tweetPath}`,
    `https://api.fxtwitter.com/${tweetPath}`,
    `https://api.fixupx.com/${tweetPath}`,
    `https://vxtwitter.com/${tweetPath}`
  ];

  for (const url of urls) {
    try {
      console.log(`\nFetching: ${url}`);
      const res = await axios.get(url, { timeout: 5000 });
      console.log(`SUCCESS! Status: ${res.status}`);
      console.log('Keys in data:', Object.keys(res.data));
      if (res.data.tweet) {
        console.log('Tweet text:', res.data.tweet.text?.substring(0, 100));
      } else {
        console.log('First 200 chars of HTML:', res.data.toString().substring(0, 200));
      }
    } catch (err) {
      console.log(`FAILED! Status: ${err.response?.status || 'network error'} - ${err.message}`);
    }
  }
}

checkDomains();
