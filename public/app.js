// Initialize Lucide Icons on document load
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  initApp();
});

// App State
const state = {
  currentPreview: null,
  activeTheme: 'dark',
  cacheList: [],
  webhooksList: [],
  webhookPollInterval: null
};

// DOM Elements
const elements = {
  themeToggle: document.getElementById('theme-toggle'),
  scraperForm: document.getElementById('scraper-form'),
  targetUrl: document.getElementById('target-url'),
  optionScreenshot: document.getElementById('option-screenshot'),
  optionRefresh: document.getElementById('option-refresh'),
  btnScrape: document.getElementById('btn-scrape'),
  
  // Platform Mockups
  discordAccent: document.getElementById('discord-accent'),
  discordSite: document.getElementById('discord-site'),
  discordTitleLink: document.getElementById('discord-title-link'),
  discordDesc: document.getElementById('discord-desc'),
  discordImg: document.getElementById('discord-img'),
  discordMetaFields: document.getElementById('discord-meta-fields'),
  
  slackAccent: document.getElementById('slack-accent'),
  slackFavicon: document.getElementById('slack-favicon'),
  slackSite: document.getElementById('slack-site'),
  slackTitleLink: document.getElementById('slack-title-link'),
  slackDesc: document.getElementById('slack-desc'),
  slackImg: document.getElementById('slack-img'),
  
  twitterImg: document.getElementById('twitter-img'),
  twitterDomain: document.getElementById('twitter-domain'),
  twitterTitle: document.getElementById('twitter-title'),
  twitterDesc: document.getElementById('twitter-desc'),
  
  linkedinImg: document.getElementById('linkedin-img'),
  linkedinTitle: document.getElementById('linkedin-title'),
  linkedinDomain: document.getElementById('linkedin-domain'),

  // Metadata Table Info
  metaValTitle: document.getElementById('meta-val-title'),
  metaValDesc: document.getElementById('meta-val-desc'),
  metaValSitename: document.getElementById('meta-val-sitename'),
  metaValAuthor: document.getElementById('meta-val-author'),
  metaValDate: document.getElementById('meta-val-date'),
  metaValType: document.getElementById('meta-val-type'),
  metaValUrl: document.getElementById('meta-val-url'),
  metaValColorBox: document.getElementById('meta-val-color-box'),
  metaValColorHex: document.getElementById('meta-val-color-hex'),
  metaValScreenshotCell: document.getElementById('meta-val-screenshot-cell'),

  // Readability Panel
  readTime: document.getElementById('read-time'),
  readAuthor: document.getElementById('read-author'),
  readabilityBody: document.getElementById('readability-body'),

  // JSON View
  jsonCodeBlock: document.getElementById('json-code-block'),
  btnCopyJson: document.getElementById('btn-copy-json'),

  // Raw HTML Tags
  rawMetaTagsTbody: document.getElementById('raw-meta-tags-tbody'),

  // Analytics Cards
  statRequests: document.getElementById('stat-requests'),
  statHitrate: document.getElementById('stat-hitrate'),
  statLatency: document.getElementById('stat-latency'),

  // Screenshot Viewer Card
  screenshotCard: document.getElementById('screenshot-card'),
  visualScreenshotImg: document.getElementById('visual-screenshot-img'),
  btnCloseScreenshot: document.getElementById('btn-close-screenshot'),

  // Caching
  cacheCount: document.getElementById('cache-count'),
  cacheItemsList: document.getElementById('cache-items-list'),
  btnPurgeCache: document.getElementById('btn-purge-cache'),

  // Webhooks
  webhookSubscribeForm: document.getElementById('webhook-subscribe-form'),
  webhookUrl: document.getElementById('webhook-url'),
  activeWebhooksList: document.getElementById('active-webhooks-list'),
  
  // Batch Scrape
  batchUrlsInput: document.getElementById('batch-urls-input'),
  batchWebhookTarget: document.getElementById('batch-webhook-target'),
  btnSubmitBatch: document.getElementById('btn-submit-batch'),

  // Webhook Console Logs
  webhookConsoleLogs: document.getElementById('webhook-console-logs'),

  // Toast container
  toastContainer: document.getElementById('toast-container'),

  // New Developer & Selector additions
  customSelectors: document.getElementById('custom-selectors'),
  btnExportPdf: document.getElementById('btn-export-pdf'),
  keyGenerationForm: document.getElementById('key-generation-form'),
  keyNameInput: document.getElementById('key-name-input'),
  activeKeysList: document.getElementById('active-keys-list'),
  metaValTechstack: document.getElementById('meta-val-techstack'),
  metaValFeeds: document.getElementById('meta-val-feeds'),
  seoScoreCircle: document.getElementById('seo-score-circle'),
  seoAuditList: document.getElementById('seo-audit-list'),
  btnFeaturesMenu: document.getElementById('btn-features-menu'),
  featuresMenu: document.getElementById('features-menu'),
  featInspector: document.getElementById('feat-inspector'),
  featAnalytics: document.getElementById('feat-analytics'),
  featScreenshot: document.getElementById('feat-screenshot'),
  featKeys: document.getElementById('feat-keys'),
  featBatch: document.getElementById('feat-batch'),
  detailTabsContainer: document.getElementById('detail-tabs-container'),
  analyticsGrid: document.getElementById('analytics-grid'),
  screenshotCard: document.getElementById('screenshot-card'),
  apiKeysCard: document.getElementById('api-keys-card'),
  webhookCard: document.getElementById('webhook-card'),
  btnScrapeInline: document.getElementById('btn-scrape-inline'),
  scrapeDiagnostics: document.getElementById('scrape-diagnostics'),
  diagStatus: document.getElementById('diag-status'),
  diagMethod: document.getElementById('diag-method'),
  diagDuration: document.getElementById('diag-duration'),
  diagCache: document.getElementById('diag-cache'),
  diagRedirects: document.getElementById('diag-redirects'),
  diagDot: document.getElementById('diag-dot'),
  optionUserAgent: document.getElementById('option-user-agent'),
  structuredDataTree: document.getElementById('structured-data-tree')
};

/**
 * Initialize Dashboard Logic
 */
function initApp() {
  setupTheme();
  setupEventListeners();
  loadCache();
  loadWebhooks();
  loadAnalytics();
  loadApiKeys();
  initFeatureCustomization();
  
  // Start polling outgoing webhook histories
  pollWebhookLogs();
  state.webhookPollInterval = setInterval(pollWebhookLogs, 2500);
}

/* ==========================================================================
   Theme & Preferences
   ========================================================================== */
function setupTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  state.activeTheme = savedTheme;
  
  elements.themeToggle.addEventListener('click', () => {
    const nextTheme = state.activeTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    state.activeTheme = nextTheme;
  });
}

/* ==========================================================================
   Event Binding Setup
   ========================================================================== */
function setupEventListeners() {
  // Scraper submit trigger
  elements.scraperForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = elements.targetUrl.value;
    const screenshot = elements.optionScreenshot.checked;
    const refresh = elements.optionRefresh.checked;
    await performScrape(url, screenshot, refresh);
  });

  // Preview Mockups tab navigation switcher
  document.querySelectorAll('.preview-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.preview-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.preview-card-container .tab-panel').forEach(p => p.classList.remove('active'));
      
      e.target.classList.add('active');
      const targetId = e.target.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Data inspection tab navigation switcher
  document.querySelectorAll('.data-tabs .data-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.data-tabs .data-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.detail-tabs-container .data-panel').forEach(p => p.classList.remove('active'));
      
      e.target.classList.add('active');
      const targetId = e.target.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Copy JSON payload button trigger
  elements.btnCopyJson.addEventListener('click', () => {
    if (!state.currentPreview) {
      showToast('No JSON response available to copy.', 'error');
      return;
    }
    navigator.clipboard.writeText(JSON.stringify(state.currentPreview, null, 2))
      .then(() => showToast('JSON payload copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy text.', 'error'));
  });

  // Purge all cache records
  elements.btnPurgeCache.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear the entire scraper cache?')) {
      try {
        const res = await fetch('/api/cache', { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
          showToast(result.message, 'success');
          loadCache();
          loadAnalytics();
        }
      } catch (err) {
        showToast('Failed to purge cache DB.', 'error');
      }
    }
  });

  // Close screenshot viewer card
  elements.btnCloseScreenshot.addEventListener('click', () => {
    elements.screenshotCard.classList.add('hidden');
  });

  // Webhook subscription form trigger
  elements.webhookSubscribeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = elements.webhookUrl.value;
    try {
      const res = await fetch('/api/webhooks/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        elements.webhookUrl.value = '';
        loadWebhooks();
      } else {
        showToast(data.error || 'Failed to subscribe.', 'error');
      }
    } catch (err) {
      showToast('Network error subscribing webhook.', 'error');
    }
  });

  // Batch bulk crawler trigger
  elements.btnSubmitBatch.addEventListener('click', async () => {
    const urlsText = elements.batchUrlsInput.value.trim();
    const webhookUrl = elements.batchWebhookTarget.value.trim();

    if (!urlsText) {
      showToast('Please insert one or more URLs to batch process.', 'error');
      return;
    }

    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    
    // Toggle button state
    elements.btnSubmitBatch.disabled = true;
    elements.btnSubmitBatch.innerText = 'Processing Batch...';

    try {
      const res = await fetch('/api/preview/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          webhookUrl: webhookUrl || undefined,
          screenshot: elements.optionScreenshot.checked
        })
      });
      
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast(`Batch job dispatched! Job ID: ${data.jobId}`, 'info');
        elements.batchUrlsInput.value = '';
        loadCache();
        loadAnalytics();
      }
    } catch (err) {
      showToast('Failed to start batch job.', 'error');
    } finally {
      elements.btnSubmitBatch.disabled = false;
      elements.btnSubmitBatch.innerText = 'Trigger Batch Scrape';
    }
  });

  // A4 PDF Export Event Listener
  elements.btnExportPdf.addEventListener('click', () => {
    if (!state.currentPreview || !state.currentPreview.url) {
      showToast('No parsed article URL available to export.', 'error');
      return;
    }
    const url = state.currentPreview.url;
    window.open(`/api/preview/pdf?url=${encodeURIComponent(url)}`, '_blank');
    showToast('Exporting clean reader PDF...', 'success');
  });

  // Key Generation Submit Event Listener
  elements.keyGenerationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = elements.keyNameInput.value.trim();
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const result = await res.json();
      if (result.success) {
        showToast('API Key generated successfully!', 'success');
        elements.keyNameInput.value = '';
        loadApiKeys();
      } else {
        showToast(result.error || 'Failed to generate key.', 'error');
      }
    } catch (err) {
      showToast('Failed to contact server.', 'error');
    }
  });
}

/* ==========================================================================
   Scraping Engine Communication
   ========================================================================== */
async function performScrape(url, screenshot = false, refresh = false) {
  // Set UI state to loading
  elements.btnScrape.disabled = true;
  elements.btnScrape.innerHTML = `<span class="btn-text">Scraping Page...</span>`;
  if (elements.btnScrapeInline) {
    elements.btnScrapeInline.disabled = true;
    elements.btnScrapeInline.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width: 18px; height: 18px;"></i>`;
    if (window.lucide) window.lucide.createIcons();
  }
  
  showToast(`Parsing metadata for ${url}...`, 'info');

  try {
    const userAgent = elements.optionUserAgent ? elements.optionUserAgent.value : '';
    const selectors = elements.customSelectors ? elements.customSelectors.value.trim() : '';
    const query = new URLSearchParams({
      url,
      screenshot: screenshot ? 'true' : 'false',
      refresh: refresh ? 'true' : 'false'
    });

    if (selectors) {
      query.append('selectors', selectors);
    }
    if (userAgent) {
      query.append('userAgent', userAgent);
    }

    const res = await fetch(`/api/preview?${query.toString()}`);
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to parse page.');
    }

    const data = await res.json();
    state.currentPreview = data;

    // Display updates
    updateMockupPreviews(data);
    updateInspectorTables(data);
    loadCache();
    loadAnalytics();
    
    // Populate Diagnostics Console
    if (elements.scrapeDiagnostics) {
      elements.scrapeDiagnostics.classList.remove('hidden');
      elements.diagStatus.innerText = '200 OK';
      elements.diagDot.className = 'dot-indicator green';
      elements.diagMethod.innerText = data.method || 'HTTP';
      elements.diagDuration.innerText = `${data.duration || 0} ms`;
      
      const cacheText = data.cacheHit ? 'HIT (SQLite DB)' : 'MISS (Fresh)';
      elements.diagCache.innerText = cacheText;
      
      // Check if redirected
      const cleanUrl = (url) => url.replace(/\/$/, '');
      if (cleanUrl(data.url) !== cleanUrl(data.resolvedUrl)) {
        try {
          elements.diagRedirects.innerText = `Redirected: ${new URL(data.resolvedUrl).hostname}`;
        } catch (e) {
          elements.diagRedirects.innerText = 'Redirected';
        }
        elements.diagRedirects.title = data.resolvedUrl;
        elements.diagRedirects.style.color = 'var(--color-warning)';
      } else {
        elements.diagRedirects.innerText = 'No redirects';
        elements.diagRedirects.title = '';
        elements.diagRedirects.style.color = 'inherit';
      }
    }

    showToast('Metadata extraction complete!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
    console.error(err);
    
    // Populate Diagnostics Console with Failure status
    if (elements.scrapeDiagnostics) {
      elements.scrapeDiagnostics.classList.remove('hidden');
      elements.diagStatus.innerText = err.message.includes('500') ? '500 Error' : 'Scrape Failed';
      elements.diagDot.className = 'dot-indicator red';
      elements.diagMethod.innerText = 'N/A';
      elements.diagDuration.innerText = 'N/A';
      elements.diagCache.innerText = 'N/A';
      elements.diagRedirects.innerText = 'Error';
      elements.diagRedirects.title = err.message;
      elements.diagRedirects.style.color = 'var(--color-danger)';
    }
  } finally {
    // Re-enable scrape button
    elements.btnScrape.disabled = false;
    elements.btnScrape.innerHTML = `
      <span class="btn-text">Extract Metadata</span>
      <i data-lucide="arrow-right" class="btn-icon-right"></i>
    `;
    if (elements.btnScrapeInline) {
      elements.btnScrapeInline.disabled = false;
      elements.btnScrapeInline.innerHTML = `<i data-lucide="arrow-right" style="width: 18px; height: 18px;"></i>`;
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

/* ==========================================================================
   Visual Embed Mockup Rendering
   ========================================================================== */
function proxyUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

function updateMockupPreviews(data) {
  const finalTitle = data.title || 'Page Title';
  const finalDesc = data.description || 'No description found on the page.';
  const finalSite = data.siteName || 'site.com';
  
  let hostname = '';
  try {
    hostname = new URL(data.resolvedUrl || data.url).hostname;
  } catch (e) {
    hostname = 'domain.com';
  }

  // 1. Theme and Dominant color adjustments
  const brandColor = data.dominantColor || '#5C6BC0';
  elements.discordAccent.style.backgroundColor = brandColor;
  elements.slackAccent.style.backgroundColor = brandColor;
  
  // 2. Discord Mockup
  elements.discordSite.innerText = finalSite;
  elements.discordTitleLink.innerText = finalTitle;
  elements.discordDesc.innerText = finalDesc;
  if (data.image) {
    elements.discordImg.src = proxyUrl(data.image);
    elements.discordImg.classList.remove('hidden');
  } else {
    elements.discordImg.classList.add('hidden');
  }

  // Discord Meta fields
  const discordFields = [];
  if (data.author) discordFields.push(`<strong>Author:</strong> ${data.author}`);
  if (data.publishedDate) {
    const formattedDate = new Date(data.publishedDate).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    // check for invalid date
    if (formattedDate !== 'Invalid Date') {
      discordFields.push(`<strong>Published:</strong> ${formattedDate}`);
    }
  }
  elements.discordMetaFields.innerHTML = discordFields.join(' &nbsp;•&nbsp; ');

  // 3. Slack Mockup
  elements.slackSite.innerText = finalSite;
  elements.slackTitleLink.innerText = finalTitle;
  elements.slackDesc.innerText = finalDesc;
  if (data.favicon) {
    elements.slackFavicon.src = proxyUrl(data.favicon);
    elements.slackFavicon.classList.remove('hidden');
  } else {
    elements.slackFavicon.classList.add('hidden');
  }
  if (data.image) {
    elements.slackImg.src = proxyUrl(data.image);
    elements.slackImg.classList.remove('hidden');
  } else {
    elements.slackImg.classList.add('hidden');
  }

  // 4. Twitter / X Mockup
  elements.twitterDomain.innerText = hostname;
  elements.twitterTitle.innerText = finalTitle;
  elements.twitterDesc.innerText = finalDesc;
  if (data.image) {
    elements.twitterImg.src = proxyUrl(data.image);
    elements.twitterImg.classList.remove('hidden');
  } else {
    elements.twitterImg.classList.add('hidden');
  }

  // 5. LinkedIn Mockup
  elements.linkedinTitle.innerText = finalTitle;
  const authorSuffix = data.author ? ` • By ${data.author}` : '';
  elements.linkedinDomain.innerText = `${hostname}${authorSuffix}`;
  if (data.image) {
    elements.linkedinImg.src = proxyUrl(data.image);
    elements.linkedinImg.classList.remove('hidden');
  } else {
    elements.linkedinImg.classList.add('hidden');
  }
}

/* ==========================================================================
   Details & Inspector Rendering
   ========================================================================== */
function setDiagnosticVal(element, val, isCritical = false) {
  element.classList.remove('val-placeholder');
  
  // Normalize missing states
  const isEmpty = !val || val === 'None' || val.trim() === '';
  
  if (!isEmpty) {
    element.style.fontFamily = 'inherit';
    element.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%;">
        <span style="word-break: break-word;">${val}</span>
        <button type="button" class="btn btn-secondary btn-icon-sm btn-copy-field" data-clipboard-text="${val.replace(/"/g, '&quot;')}" title="Copy field value" style="flex-shrink: 0; padding: 0.15rem 0.3rem;">
          <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
    `;
  } else {
    const badgeClass = isCritical ? 'badge-danger' : 'badge-warning';
    const warningText = isCritical ? 'Missing (Critical tag)' : 'Missing (Recommended tag)';
    element.innerHTML = `<span class="${badgeClass}">${warningText}</span>`;
  }
}

function updateInspectorTables(data) {
  // Update Parsed Data fields with diagnostic validations
  setDiagnosticVal(elements.metaValTitle, data.title, true);
  setDiagnosticVal(elements.metaValDesc, data.description, true);
  setDiagnosticVal(elements.metaValSitename, data.siteName, false);
  setDiagnosticVal(elements.metaValAuthor, data.author, false);
  
  const dateText = data.publishedDate ? new Date(data.publishedDate).toLocaleString() : '';
  setDiagnosticVal(elements.metaValDate, dateText, false);
  
  setDiagnosticVal(elements.metaValType, data.contentType, false);
  
  elements.metaValUrl.innerHTML = `<a href="${data.resolvedUrl}" target="_blank" class="screenshot-link">${data.resolvedUrl} <i data-lucide="external-link" class="icon-inline"></i></a>`;
  
  elements.metaValColorHex.innerText = data.dominantColor || '#5C6BC0';
  elements.metaValColorBox.style.backgroundColor = data.dominantColor || '#5C6BC0';

  // Playwright screenshot view
  if (data.screenshotUrl) {
    elements.metaValScreenshotCell.innerHTML = `
      <span class="screenshot-link" id="btn-view-screenshot-link">
        <i data-lucide="image" class="icon-inline"></i> View Screenshot Image
      </span>
    `;
    
    // Bind click to open viewer
    document.getElementById('btn-view-screenshot-link').addEventListener('click', () => {
      elements.visualScreenshotImg.src = data.screenshotUrl;
      elements.screenshotCard.classList.remove('hidden');
      elements.screenshotCard.scrollIntoView({ behavior: 'smooth' });
    });
  } else {
    elements.metaValScreenshotCell.innerHTML = `<span class="val-placeholder">No screenshot captured (Run with "Capture Screenshot" option).</span>`;
  }

  // Bind dynamic field copying events
  document.querySelectorAll('.btn-copy-field').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.getAttribute('data-clipboard-text');
      navigator.clipboard.writeText(text)
        .then(() => showToast('Field value copied to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy.', 'error'));
    });
  });

  // Remove any previously rendered custom selector rows
  document.querySelectorAll('#data-meta tbody tr.custom-selector-row').forEach(row => row.remove());

  // Render newly extracted custom selectors
  const tableBody = document.querySelector('#data-meta tbody');
  if (data.customFields && typeof data.customFields === 'object') {
    Object.entries(data.customFields).forEach(([key, val]) => {
      const row = document.createElement('tr');
      row.className = 'custom-selector-row';
      row.innerHTML = `
        <td style="color: var(--color-primary); font-weight: 600;">Custom: ${key}</td>
        <td class="${val ? '' : 'val-placeholder'}">${val || 'Not found'}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  // Update Readability
  elements.readTime.innerText = data.readingTime || 0;
  elements.readAuthor.innerText = data.author ? `By ${data.author}` : 'Author Unknown';
  
  if (data.readabilityHtml) {
    elements.readabilityBody.innerHTML = `
      <h3>Excerpt</h3>
      <p style="font-style: italic; border-left: 2px solid var(--color-border); padding-left: 0.8rem; margin-bottom: 1.5rem;">
        ${data.description || 'No excerpt available.'}
      </p>
      ${data.readabilityHtml}
    `;
  } else {
    elements.readabilityBody.innerHTML = `
      <p class="placeholder-text">Could not parse structured readable text from this page. Below is the parsed description fallback:</p>
      <p>${data.description || 'No content parsed.'}</p>
    `;
  }

  // Update JSON raw display
  elements.jsonCodeBlock.innerText = JSON.stringify(data, null, 2);

  // Update Raw HTML Meta table
  const tbody = elements.rawMetaTagsTbody;
  tbody.innerHTML = '';

  const metaKeys = Object.keys(data.rawMeta || {});
  if (metaKeys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center placeholder-text">No standard meta tags extracted.</td></tr>`;
  } else {
    metaKeys.sort().forEach(key => {
      const row = document.createElement('tr');
      
      const keyCell = document.createElement('td');
      keyCell.innerText = key;
      keyCell.style.fontFamily = 'monospace';
      
      const valCell = document.createElement('td');
      valCell.innerText = data.rawMeta[key];
      valCell.style.wordBreak = 'break-all';
      
      row.appendChild(keyCell);
      row.appendChild(valCell);
      tbody.appendChild(row);
    });
  }

  // Update Tech Stack UI
  if (data.techStack && data.techStack.length > 0) {
    elements.metaValTechstack.innerHTML = data.techStack.map(tech => `<span class="badge">${tech}</span>`).join(' ');
  } else {
    elements.metaValTechstack.innerHTML = '<span class="val-placeholder">No technologies detected.</span>';
  }

  // Update Feeds UI
  if (data.feeds && data.feeds.length > 0) {
    elements.metaValFeeds.innerHTML = data.feeds.map(feed => {
      let feedType = 'Feed';
      if (feed.includes('sitemap')) feedType = 'Sitemap';
      else if (feed.endsWith('.xml')) feedType = 'XML';
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.3rem; width: 100%;">
          <a href="${feed}" target="_blank" class="screenshot-link" style="word-break: break-all; min-width: 0; flex-grow: 1;">${feedType}: ${feed} <i data-lucide="external-link" class="icon-inline"></i></a>
          <button type="button" class="btn btn-secondary btn-icon-sm btn-explore-feed" data-feed-url="${feed}" title="Explore links inside feed" style="padding: 0.15rem 0.3rem; flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.2rem;">
            <i data-lucide="compass" style="width: 12px; height: 12px;"></i> Explore
          </button>
        </div>
      `;
    }).join('');

    // Bind sitemap explorer buttons
    document.querySelectorAll('.btn-explore-feed').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const feedUrl = btn.getAttribute('data-feed-url');
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width: 12px; height: 12px;"></i> Exploring...`;
        if (window.lucide) window.lucide.createIcons();
        
        try {
          showToast(`Exploring sitemap feed nodes for ${feedUrl}...`, 'info');
          const res = await fetch(`/api/feed/explore?url=${encodeURIComponent(feedUrl)}`);
          if (!res.ok) throw new Error('Crawl explore feed API returned error.');
          const urls = await res.json();
          
          if (urls.length === 0) {
            showToast('No crawlable child urls discovered in sitemap/feed.', 'warning');
          } else {
            const urlsText = urls.map(u => u.url).join('\n');
            elements.batchUrlsInput.value = urlsText;
            
            // Expand Batch Toggles settings if closed
            const batchCheck = document.getElementById('feat-batch');
            if (batchCheck && !batchCheck.checked) {
              batchCheck.checked = true;
              batchCheck.dispatchEvent(new Event('change'));
            }
            
            elements.webhookCard.scrollIntoView({ behavior: 'smooth' });
            showToast(`Loaded ${urls.length} links into Bulk Scraper workspace!`, 'success');
          }
        } catch (err) {
          showToast(`Failed to parse feed: ${err.message}`, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<i data-lucide="compass" style="width: 12px; height: 12px;"></i> Explore`;
          if (window.lucide) window.lucide.createIcons();
        }
      });
    });
  } else {
    elements.metaValFeeds.innerHTML = '<span class="val-placeholder">No RSS or Sitemap feeds discovered.</span>';
  }

  // Render JSON-LD Structured schema tree
  renderJsonLdTree(data.jsonLd, elements.structuredDataTree);

  // Update SEO Health Audit UI
  const seo = data.seo || { score: 0, checklist: [] };
  elements.seoScoreCircle.innerText = seo.score;
  elements.seoScoreCircle.style.borderColor = seo.score >= 80 ? 'var(--color-success)' : (seo.score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)');

  const auditList = elements.seoAuditList;
  auditList.innerHTML = '';
  if (seo.checklist.length === 0) {
    auditList.innerHTML = '<li class="webhook-empty">No SEO checklist items to audit.</li>';
  } else {
    seo.checklist.forEach(item => {
      const li = document.createElement('li');
      li.className = 'subscribed-item';
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '0.5rem';
      li.style.padding = '0.5rem 0.8rem';
      
      let icon = 'check-circle';
      let iconColor = 'var(--color-success)';
      if (item.status === 'fail') {
        icon = 'x-circle';
        iconColor = 'var(--color-danger)';
      } else if (item.status === 'warning') {
        icon = 'alert-triangle';
        iconColor = 'var(--color-warning)';
      }
      
      li.innerHTML = `
        <i data-lucide="${icon}" style="color: ${iconColor}; flex-shrink: 0; width: 18px; height: 18px;"></i>
        <div style="flex-grow: 1;">
          <span style="font-weight: 600; font-size: 0.85rem; color: var(--color-text-primary);">${item.rule}</span>
          <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block; margin-top: 0.1rem;">${item.desc}</span>
        </div>
        ${item.points < 0 ? `<span style="font-size: 0.75rem; font-weight: 600; color: ${iconColor};">${item.points} pts</span>` : ''}
      `;
      auditList.appendChild(li);
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

/* ==========================================================================
   Data Fetching: Caches & Webhooks & Analytics
   ========================================================================== */

// Load SQLite Cache Records List
async function loadCache() {
  try {
    const res = await fetch('/api/cache');
    const list = await res.json();
    state.cacheList = list;
    
    elements.cacheCount.innerText = list.length;
    const cacheListElement = elements.cacheItemsList;
    cacheListElement.innerHTML = '';
    
    if (list.length === 0) {
      cacheListElement.innerHTML = '<li class="cache-empty">No cached URLs found.</li>';
      return;
    }

    list.forEach(item => {
      const li = document.createElement('li');
      li.className = 'cache-item';
      
      const date = new Date(item.scrapedAt).toLocaleDateString();
      const methodBadge = item.method === 'Browser' ? 'Playwright' : 'HTTP';
      
      li.innerHTML = `
        <div class="cache-item-details" style="cursor: pointer;">
          <div class="cache-item-title" title="${item.title || 'Untitled'}">${item.title || 'Untitled'}</div>
          <div class="cache-item-url" title="${item.url}">${item.url}</div>
          <div class="cache-item-meta">
            <span class="badge" style="padding: 0.05rem 0.3rem; font-size: 0.65rem;">${methodBadge}</span>
            <span>⏱️ ${item.duration}ms</span>
            <span>📅 ${date}</span>
          </div>
        </div>
        <div class="cache-item-actions">
          <button class="btn btn-secondary btn-icon-sm btn-load" title="Inspect cached payload"><i data-lucide="eye" style="width: 14px; height: 14px;"></i></button>
          <button class="btn btn-secondary btn-icon-sm btn-refresh" title="Re-scrape and override"><i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i></button>
          <button class="btn btn-secondary btn-icon-sm btn-delete" title="Purge from cache"><i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--color-danger);"></i></button>
        </div>
      `;

      // Bind actions
      li.querySelector('.cache-item-details').addEventListener('click', () => {
        elements.targetUrl.value = item.url;
        performScrape(item.url, false, false);
      });
      li.querySelector('.btn-load').addEventListener('click', () => {
        elements.targetUrl.value = item.url;
        performScrape(item.url, false, false);
      });
      li.querySelector('.btn-refresh').addEventListener('click', () => {
        elements.targetUrl.value = item.url;
        performScrape(item.url, elements.optionScreenshot.checked, true);
      });
      li.querySelector('.btn-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch(`/api/cache?url=${encodeURIComponent(item.url)}`, { method: 'DELETE' });
          const result = await res.json();
          if (result.success) {
            showToast('URL cache cleared.', 'info');
            loadCache();
            loadAnalytics();
          }
        } catch (err) {
          showToast('Failed to delete item.', 'error');
        }
      });

      cacheListElement.appendChild(li);
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Failed to load cache list.', err);
  }
}

// Load Subscribed Webhooks List
async function loadWebhooks() {
  try {
    const res = await fetch('/api/webhooks');
    const hooks = await res.json();
    state.webhooksList = hooks;
    
    const listElement = elements.activeWebhooksList;
    listElement.innerHTML = '';
    
    if (hooks.length === 0) {
      listElement.innerHTML = '<li class="webhook-empty">No active webhook URL subscriptions.</li>';
      return;
    }

    hooks.forEach(hook => {
      const li = document.createElement('li');
      li.className = 'subscribed-item';
      li.innerHTML = `
        <div style="display: flex; flex-direction: column; min-width: 0; flex-grow: 1;">
          <span class="subscribed-item-url" title="${hook.url}" style="font-weight: 500; font-size: 0.8rem;">${hook.url}</span>
          <span style="font-family: monospace; font-size: 0.75rem; color: var(--color-primary); cursor: pointer;" class="webhook-secret-text" title="Click to copy secret">${hook.secret || 'No secret'}</span>
        </div>
        <button title="Unsubscribe" class="btn-unsubscribe-hook"><i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--color-danger);"></i></button>
      `;

      // Copy secret key click
      li.querySelector('.webhook-secret-text').addEventListener('click', () => {
        if (!hook.secret) return;
        navigator.clipboard.writeText(hook.secret)
          .then(() => showToast('Webhook secret key copied to clipboard!', 'success'))
          .catch(() => showToast('Failed to copy secret.', 'error'));
      });

      li.querySelector('.btn-unsubscribe-hook').addEventListener('click', async () => {
        try {
          const res = await fetch(`/api/webhooks/unsubscribe?url=${encodeURIComponent(hook.url)}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            showToast('Webhook subscription removed.', 'info');
            loadWebhooks();
          }
        } catch (err) {
          showToast('Failed to unsubscribe.', 'error');
        }
      });

      listElement.appendChild(li);
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Failed to load webhooks.', err);
  }
}

// Load Caching Analytics Summary
async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    const stats = await res.json();

    elements.statRequests.innerText = stats.totalRequests || 0;
    elements.statHitrate.innerText = `${Math.round(stats.cacheHitRate || 0)}%`;
    elements.statLatency.innerText = `${stats.avgMissDuration || 0} ms`;
  } catch (err) {
    console.error('Failed to load analytics summaries.', err);
  }
}

// Poll Webhook Outgoing Histories
async function pollWebhookLogs() {
  try {
    const res = await fetch('/api/webhooks/history');
    const logs = await res.json();
    
    const consoleLogs = elements.webhookConsoleLogs;
    
    if (logs.length === 0) {
      consoleLogs.innerHTML = '<div class="console-placeholder">// Dynamic logs from outgoing webhook dispatches will print here...</div>';
      return;
    }
    
    consoleLogs.innerHTML = '';
    logs.forEach(log => {
      const entry = document.createElement('div');
      entry.className = 'console-entry';
      
      const timeStr = new Date(log.timestamp).toLocaleTimeString();
      const statusClass = log.status === 'success' ? 'c-success' : (log.status === 'pending' ? 'c-pending' : 'c-failed');
      const statusText = log.status.toUpperCase();
      
      entry.innerHTML = `
        <div class="console-entry-header">
          <span class="c-timestamp">[${timeStr}]</span>
          <span>DISPATCH: <span class="${statusClass}">${statusText}</span> (Code: ${log.statusCode || 'N/A'}, Try: ${log.attempts})</span>
        </div>
        <div class="console-entry-body" title="${log.url}">POST ➡️ ${log.url}</div>
      `;
      
      if (log.error) {
        const errDiv = document.createElement('div');
        errDiv.className = 'console-entry-error';
        errDiv.innerText = `Error: ${log.error}`;
        entry.appendChild(errDiv);
      }
      
      consoleLogs.appendChild(entry);
    });
  } catch (err) {
    console.error('Failed to pull webhook logs.', err);
  }
}

// Fetch and load active Developer API Keys
async function loadApiKeys() {
  try {
    const res = await fetch('/api/keys');
    const keys = await res.json();
    
    const listElement = elements.activeKeysList;
    listElement.innerHTML = '';
    
    if (keys.length === 0) {
      listElement.innerHTML = '<li class="webhook-empty">No developer API keys active.</li>';
      return;
    }

    keys.forEach(key => {
      const li = document.createElement('li');
      li.className = 'subscribed-item';
      li.innerHTML = `
        <div style="display: flex; flex-direction: column; min-width: 0; flex-grow: 1;">
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--color-text-primary);">${key.name}</span>
          <span style="font-family: monospace; font-size: 0.75rem; color: var(--color-primary); cursor: pointer;" class="api-key-text" title="Click to copy">${key.apiKey}</span>
          <span style="font-size: 0.65rem; color: var(--color-text-muted);">Requests: ${key.requestsCount} / ${key.limitCount}</span>
        </div>
        <button title="Revoke Key" class="btn-revoke-key"><i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--color-danger);"></i></button>
      `;

      // Click to copy key
      li.querySelector('.api-key-text').addEventListener('click', () => {
        navigator.clipboard.writeText(key.apiKey)
          .then(() => showToast('API key copied to clipboard!', 'success'))
          .catch(() => showToast('Failed to copy API key.', 'error'));
      });

      // Revoke key click
      li.querySelector('.btn-revoke-key').addEventListener('click', async () => {
        if (confirm(`Are you sure you want to revoke key "${key.name}"?`)) {
          try {
            const res = await fetch(`/api/keys?apiKey=${encodeURIComponent(key.apiKey)}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
              showToast('API Key revoked successfully.', 'info');
              loadApiKeys();
            }
          } catch (err) {
            showToast('Failed to revoke API key.', 'error');
          }
        }
      });

      listElement.appendChild(li);
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Failed to load API keys list.', err);
  }
}

/* ==========================================================================
   Toast Notification Helper
   ========================================================================== */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <div class="toast-message">${message}</div>
  `;

  elements.toastContainer.appendChild(toast);
  
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Slide out after 3.5 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3500);
}

/* ==========================================================================
   Feature Customization Configuration
   ========================================================================== */
function initFeatureCustomization() {
  if (!elements.btnFeaturesMenu) return;

  // Toggle menu dropdown open/close
  elements.btnFeaturesMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.featuresMenu.classList.toggle('show');
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (elements.featuresMenu && !elements.featuresMenu.contains(e.target) && e.target !== elements.btnFeaturesMenu) {
      elements.featuresMenu.classList.remove('show');
    }
  });

  // Bind change listeners to checkboxes
  const features = [
    { chk: elements.featInspector, target: elements.detailTabsContainer, key: 'feat_inspector' },
    { chk: elements.featAnalytics, target: elements.analyticsGrid, key: 'feat_analytics' },
    { chk: elements.featScreenshot, target: elements.screenshotCard, key: 'feat_screenshot' },
    { chk: elements.featKeys, target: elements.apiKeysCard, key: 'feat_keys' },
    { chk: elements.featBatch, target: elements.webhookCard, key: 'feat_batch' }
  ];

  features.forEach(({ chk, target, key }) => {
    if (!chk || !target) return;

    // Load initial state from localStorage (default: true)
    const isEnabled = localStorage.getItem(key) !== 'false';
    chk.checked = isEnabled;
    toggleElement(target, isEnabled);

    chk.addEventListener('change', () => {
      toggleElement(target, chk.checked);
      localStorage.setItem(key, chk.checked);
    });
  });
}

function toggleElement(element, isVisible) {
  if (isVisible) {
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
  }
}

function renderJsonLdTree(jsonLdList, container) {
  if (!container) return;
  container.innerHTML = '';
  
  if (!jsonLdList || jsonLdList.length === 0) {
    container.innerHTML = '<div class="webhook-empty">No JSON-LD structured schemas detected on this page.</div>';
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '0.8rem';

  jsonLdList.forEach((schema, idx) => {
    const type = schema['@type'] || 'Object';
    const context = schema['@context'] ? ` (${schema['@context']})` : '';
    
    const details = document.createElement('details');
    details.style.border = '1px solid var(--color-border)';
    details.style.borderRadius = '8px';
    details.style.backgroundColor = 'var(--color-bg)';
    details.style.padding = '0.6rem 0.8rem';
    
    if (idx === 0) details.open = true; // Open the first item automatically

    details.innerHTML = `
      <summary style="cursor: pointer; font-weight: 600; color: var(--color-primary); list-style: none; display: flex; align-items: center; gap: 0.5rem; outline: none; user-select: none;">
        <i data-lucide="chevron-right" style="width: 16px; height: 16px; transition: transform 0.2s;" class="accordion-arrow"></i>
        <i data-lucide="database" style="width: 14px; height: 14px;"></i>
        <span>${type}</span>
        <span style="font-size: 0.7rem; color: var(--color-text-muted); font-weight: normal; margin-left: 0.2rem;">${context}</span>
      </summary>
      <div style="margin-top: 0.8rem; border-top: 1px dashed var(--color-border); padding-top: 0.6rem;">
        <pre style="margin: 0; padding: 0.5rem; background-color: rgba(0,0,0,0.15); border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 0.8rem; line-height: 1.4; max-height: 350px; overflow-y: auto; color: var(--color-text-primary);">${JSON.stringify(schema, null, 2)}</pre>
      </div>
    `;

    // Setup arrow rotating on toggle
    details.addEventListener('toggle', () => {
      const arrow = details.querySelector('.accordion-arrow');
      if (details.open) {
        arrow.style.transform = 'rotate(90deg)';
      } else {
        arrow.style.transform = 'rotate(0deg)';
      }
    });

    // Rotate initially if open
    if (details.open) {
      const arrow = details.querySelector('.accordion-arrow');
      if (arrow) arrow.style.transform = 'rotate(90deg)';
    }

    list.appendChild(details);
  });

  container.appendChild(list);
  if (window.lucide) window.lucide.createIcons();
}
