import axios from 'axios';
import crypto from 'crypto';

class WebhookManager {
  constructor() {
    this.history = [];
  }

  /**
   * Retrieve the list of recent webhook dispatches (up to 50 items)
   */
  getHistory() {
    return this.history;
  }

  /**
   * Dispatches a webhook payload to a client endpoint with retry mechanics
   * @param {string} webhookUrl - Destination HTTP POST URL
   * @param {object} payload - Scrape results payload
   * @param {string} secret - Unique webhook secret key
   */
  async dispatch(webhookUrl, payload, secret = null) {
    const logEntry = {
      id: 'wh_' + Math.random().toString(36).substr(2, 9),
      url: webhookUrl,
      timestamp: new Date().toISOString(),
      payload,
      status: 'pending',
      attempts: 0,
      statusCode: null,
      error: null
    };

    // Keep history capped at 50 records
    this.history.unshift(logEntry);
    if (this.history.length > 50) {
      this.history.pop();
    }

    // Run queue trigger asynchronously
    this.sendWithRetry(webhookUrl, payload, logEntry, secret);
  }

  async sendWithRetry(webhookUrl, payload, logEntry, secret) {
    const maxAttempts = 3;
    let success = false;
    let delay = 2000; // Starting retry delay

    while (logEntry.attempts < maxAttempts && !success) {
      logEntry.attempts++;
      try {
        const headers = { 
          'Content-Type': 'application/json',
          'User-Agent': 'LinkLessData-Webhook-Dispatcher/1.0'
        };

        if (secret) {
          const timestamp = Date.now().toString();
          // Generate signature from payload
          const signature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
          
          headers['X-LinkLess-Signature'] = `sha256=${signature}`;
          headers['X-LinkLess-Timestamp'] = timestamp;
        }

        const response = await axios.post(webhookUrl, payload, {
          headers,
          timeout: 5000
        });

        logEntry.status = 'success';
        logEntry.statusCode = response.status;
        success = true;
      } catch (err) {
        logEntry.statusCode = err.response?.status || null;
        logEntry.error = err.message || 'Network error';

        if (logEntry.attempts < maxAttempts) {
          // Linear backoff wait
          await new Promise(resolve => setTimeout(resolve, delay * logEntry.attempts));
        } else {
          logEntry.status = 'failed';
        }
      }
    }
  }
}

export const webhookManager = new WebhookManager();
