import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = path.join(__dirname, '../data');
if (!IS_VERCEL && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = IS_VERCEL ? ':memory:' : path.join(DATA_DIR, 'cache.db');

class CacheManager {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Failed to connect to SQLite cache database:', err);
      } else {
        this.initSchema();
      }
    });
  }

  initSchema() {
    this.db.serialize(() => {
      // Previews table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS previews (
          url TEXT PRIMARY KEY,
          title TEXT,
          description TEXT,
          image TEXT,
          siteName TEXT,
          favicon TEXT,
          author TEXT,
          publishedDate TEXT,
          contentType TEXT,
          dominantColor TEXT,
          screenshotUrl TEXT,
          readabilityText TEXT,
          readabilityHtml TEXT,
          readingTime INTEGER,
          scrapedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          duration INTEGER,
          method TEXT
        )
      `);

      // API Keys table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS api_keys (
          apiKey TEXT PRIMARY KEY,
          name TEXT,
          status TEXT DEFAULT 'active',
          requestsCount INTEGER DEFAULT 0,
          limitCount INTEGER DEFAULT 1000,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Webhooks table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS webhooks (
          url TEXT PRIMARY KEY,
          secret TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, () => {
        this.db.run('ALTER TABLE webhooks ADD COLUMN secret TEXT', (err) => {
          // Ignore error if column already exists
        });
      });

      // Analytics request logs table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS requests_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          hit INTEGER,
          duration INTEGER,
          apiKey TEXT
        )
      `, () => {
        // Ensure apiKey column exists in requests_log if table was already created
        this.db.run('ALTER TABLE requests_log ADD COLUMN apiKey TEXT', (err) => {
          // Ignore error if column already exists
        });
      });
    });
  }

  // Get preview from cache
  getPreview(url) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM previews WHERE url = ?', [url], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  // Save preview to cache
  savePreview(preview) {
    const query = `
      INSERT OR REPLACE INTO previews (
        url, title, description, image, siteName, favicon, author, 
        publishedDate, contentType, dominantColor, screenshotUrl, 
        readabilityText, readabilityHtml, readingTime, scrapedAt, duration, method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `;
    const params = [
      preview.url,
      preview.title || null,
      preview.description || null,
      preview.image || null,
      preview.siteName || null,
      preview.favicon || null,
      preview.author || null,
      preview.publishedDate || null,
      preview.contentType || null,
      preview.dominantColor || null,
      preview.screenshotUrl || null,
      preview.readabilityText || null,
      preview.readabilityHtml || null,
      preview.readingTime || 0,
      preview.duration || 0,
      preview.method || 'HTTP'
    ];

    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  // Delete preview from cache
  deletePreview(url) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM previews WHERE url = ?', [url], function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      });
    });
  }

  // Clear cache completely
  clearCache() {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM previews', function(err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });
  }

  // Get list of all cached previews (ordered by most recent)
  getCachedList() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT url, title, siteName, method, scrapedAt, duration FROM previews ORDER BY scrapedAt DESC', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  // Log a preview request for analytics
  logRequest(url, hit, duration, apiKey = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO requests_log (url, hit, duration, apiKey) VALUES (?, ?, ?, ?)',
        [url, hit ? 1 : 0, duration, apiKey],
        (err) => {
          if (err) console.error('Failed to log request in db:', err);
          resolve();
        }
      );
    });
  }

  // Fetch analytics summary
  getAnalytics() {
    return new Promise((resolve, reject) => {
      const stats = {};
      
      this.db.serialize(() => {
        // Total queries
        this.db.get('SELECT COUNT(*) as total FROM requests_log', (err, row) => {
          if (err) return reject(err);
          stats.totalRequests = row.total;

          // Hits and Misses
          this.db.get('SELECT COUNT(*) as hits FROM requests_log WHERE hit = 1', (err, rowHit) => {
            if (err) return reject(err);
            stats.cacheHits = rowHit.hits;
            stats.cacheMisses = stats.totalRequests - stats.cacheHits;
            stats.cacheHitRate = stats.totalRequests > 0 ? (stats.cacheHits / stats.totalRequests) * 100 : 0;

            // Average response times for Hits vs Misses
            this.db.get('SELECT AVG(duration) as avgHit FROM requests_log WHERE hit = 1', (err, rowAvgHit) => {
              if (err) return reject(err);
              stats.avgHitDuration = Math.round(rowAvgHit.avgHit || 0);

              this.db.get('SELECT AVG(duration) as avgMiss FROM requests_log WHERE hit = 0', (err, rowAvgMiss) => {
                if (err) return reject(err);
                stats.avgMissDuration = Math.round(rowAvgMiss.avgMiss || 0);

                // Latency list (last 20 requests)
                this.db.all('SELECT timestamp, duration, hit FROM requests_log ORDER BY timestamp DESC LIMIT 20', (err, rowsLogs) => {
                  if (err) return reject(err);
                  stats.latencyHistory = rowsLogs.reverse();
                  
                  // Method distribution
                  this.db.all('SELECT method, COUNT(*) as count FROM previews GROUP BY method', (err, rowsMethod) => {
                    if (err) return reject(err);
                    stats.methodDistribution = rowsMethod;
                    resolve(stats);
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  // Webhook: Subscribe
  addWebhook(url) {
    const secret = 'whsec_' + crypto.randomBytes(16).toString('hex');
    return new Promise((resolve, reject) => {
      this.db.run('INSERT OR REPLACE INTO webhooks (url, secret) VALUES (?, ?)', [url, secret], (err) => {
        if (err) return reject(err);
        resolve(secret);
      });
    });
  }

  // Webhook: Unsubscribe
  removeWebhook(url) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM webhooks WHERE url = ?', [url], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  // Webhook: Get all subscribers
  getWebhooks() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT url, secret FROM webhooks', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  // API Key management methods
  generateApiKey(name) {
    const randomHex = crypto.randomBytes(20).toString('hex');
    const apiKey = `sk_live_${randomHex}`;
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO api_keys (apiKey, name) VALUES (?, ?)',
        [apiKey, name],
        (err) => {
          if (err) return reject(err);
          resolve(apiKey);
        }
      );
    });
  }

  getApiKeys() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT apiKey, name, status, requestsCount, limitCount, createdAt FROM api_keys ORDER BY createdAt DESC', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  revokeApiKey(apiKey) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM api_keys WHERE apiKey = ?', [apiKey], function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      });
    });
  }

  validateApiKey(apiKey) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM api_keys WHERE apiKey = ? AND status = "active"', [apiKey], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve({ valid: false, reason: 'invalid_key' });
        
        // Check limit quota
        if (row.requestsCount >= row.limitCount) {
          return resolve({ valid: false, reason: 'rate_limit_exceeded' });
        }

        // Increment requests counter on success
        this.db.run('UPDATE api_keys SET requestsCount = requestsCount + 1 WHERE apiKey = ?', [apiKey], (updateErr) => {
          if (updateErr) console.error('Failed to increment api key requestsCount:', updateErr);
          resolve({ valid: true, row });
        });
      });
    });
  }
}

export const cache = new CacheManager();
