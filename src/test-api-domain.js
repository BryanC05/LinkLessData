import axios from 'axios';

async function checkDomains() {
  const domains = [
    'https://api.fxtwitter.com/jack/status/20',
    'https://api.fixtweet.com/jack/status/20'
  ];

  for (const url of domains) {
    try {
      console.log(`\nTesting API domain: ${url}`);
      const res = await axios.get(url, { timeout: 5000 });
      console.log(`SUCCESS! Status: ${res.status}`);
      console.log('JSON returned:', JSON.stringify(res.data, null, 2).substring(0, 300));
    } catch (err) {
      console.log(`FAILED! Status: ${err.response?.status || 'network error'} - ${err.message}`);
    }
  }
}

checkDomains();
