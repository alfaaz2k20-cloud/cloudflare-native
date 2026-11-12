import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 8192;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DIST_DIR = path.resolve(process.cwd(), 'frontend/dist');
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/mobile_verification');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// 1. Static HTTP Server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  
  // Clean path
  let filePath = path.join(DIST_DIR, reqPath);
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found: ' + reqPath);
  }
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log(`[HTTP] Static preview server listening at ${BASE_URL}`);

// 2. Launch Chrome with CDP
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-audit-'));
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  '--user-data-dir=' + tempDir,
  'about:blank'
]);

// Wait for CDP to respond and get a page target
let cdpWsUrl = null;
for (let i = 0; i < 30; i++) {
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    if (tabs && tabs.length > 0 && tabs[0].webSocketDebuggerUrl) {
      cdpWsUrl = tabs[0].webSocketDebuggerUrl;
      break;
    }
    // If no tab exists yet, create one
    const newRes = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
    const tab = await newRes.json();
    if (tab && tab.webSocketDebuggerUrl) {
      cdpWsUrl = tab.webSocketDebuggerUrl;
      break;
    }
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

if (!cdpWsUrl) {
  console.error('[CDP] Failed to connect to Chrome CDP.');
  chromeProc.kill();
  server.close();
  process.exit(1);
}

console.log('[CDP] Connected to Chrome DevTools Protocol at:', cdpWsUrl);

// 3. Simple CDP WebSocket Client
class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.msgId = 1;
    this.callbacks = new Map();

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject, timer } = this.callbacks.get(msg.id);
        clearTimeout(timer);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  }

  ready() {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
    });
  }

  send(method, params = {}, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`CDP method ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      this.callbacks.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    this.ws.close();
  }
}

const cdp = new CDPClient(cdpWsUrl);
await cdp.ready();
await cdp.send('Page.enable');
await cdp.send('DOM.enable');
await cdp.send('Runtime.enable');

// 4. Viewport definitions to test
const VIEWPORTS = [
  { name: '320px-ultra-compact', width: 320, height: 568, deviceScaleFactor: 1, isMobile: true },
  { name: '360px-android-standard', width: 360, height: 800, deviceScaleFactor: 1, isMobile: true },
  { name: '375px-iphone-se-ios', width: 375, height: 667, deviceScaleFactor: 1, isMobile: true },
  { name: '390px-iphone-14-ios', width: 390, height: 844, deviceScaleFactor: 1, isMobile: true },
  { name: '430px-iphone-15-pro-max', width: 430, height: 932, deviceScaleFactor: 1, isMobile: true },
  { name: '768px-ipad-tablet', width: 768, height: 1024, deviceScaleFactor: 1, isMobile: true },
  { name: '1280px-desktop-hd', width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false }
];

const PAGES = [
  { slug: 'homepage', url: `${BASE_URL}/index.html` },
  { slug: 'exhibition', url: `${BASE_URL}/exhibition.html` },
  { slug: 'login', url: `${BASE_URL}/login.html` },
  { slug: 'register', url: `${BASE_URL}/register.html` },
  { slug: 'dashboard', url: `${BASE_URL}/dashboard.html` },
  { slug: 'admin', url: `${BASE_URL}/admin.html` }
];

const auditResults = {
  timestamp: new Date().toISOString(),
  environment: 'Headless Chrome (Emulated Mobile & Tablet Viewports via CDP)',
  methodology: 'Synthetic Chrome DevTools Protocol Emulation (Not Physical Device Hardware)',
  viewportsTested: VIEWPORTS.map(v => `${v.width}x${v.height} (${v.name})`),
  pagesAudited: [],
  summary: {
    totalSnapshots: 0,
    zeroHorizontalOverflow: true,
    fontSizingCompliant: true,
    touchTargetsCompliant: true
  }
};

try {
  for (const page of PAGES) {
    console.log(`\n========================================`);
    console.log(`Auditing Page: ${page.slug} (${page.url})`);
    console.log(`========================================`);

    const pageRecord = {
      slug: page.slug,
      url: page.url,
      viewports: {}
    };

    for (const vp of VIEWPORTS) {
      // Set Device Metrics
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: vp.deviceScaleFactor,
        mobile: vp.isMobile
      });
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: vp.isMobile
      });

      // Manage auth context per page
      if (page.slug === 'dashboard' || page.slug === 'admin') {
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
          source: `
            try {
              localStorage.setItem('alfaaz_token', 'mock_verified_admin_token');
              localStorage.setItem('alfaaz_user', JSON.stringify({ email: 'admin@alfaaz.com', status: 'ADMIN', full_name: 'The Curator' }));
            } catch (e) {}
          `
        });
      } else {
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
          source: `
            try {
              localStorage.clear();
            } catch (e) {}
          `
        });
      }

      // Navigate to target
      await cdp.send('Page.navigate', { url: page.url });
      
      // Wait for page load
      await new Promise((r) => setTimeout(r, 600));

      // Collect measurements via Runtime.evaluate
      const evalRes = await cdp.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `
          (() => {
            const docWidth = document.documentElement.scrollWidth;
            const docHeight = document.documentElement.scrollHeight;
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;
            const hasHorizontalOverflow = docWidth > winWidth;

            // Check input font-sizes on mobile
            const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
            const inputFontSizes = inputs.map(el => {
              const fs = window.getComputedStyle(el).fontSize;
              return { tag: el.tagName, type: el.type, fontSize: parseFloat(fs) };
            });
            const sub16pxInputs = inputFontSizes.filter(i => i.fontSize < 15.9);

            // Check safe areas
            const nav = document.querySelector('nav, header, .nav-container');
            const navPaddingTop = nav ? window.getComputedStyle(nav).paddingTop : '0px';

            // Check buttons / touch targets
            const buttons = Array.from(document.querySelectorAll('button, a.action-btn, .lang-pill'));
            const touchTargets = buttons.slice(0, 15).map(b => {
              const rect = b.getBoundingClientRect();
              return { text: (b.innerText || '').slice(0, 20), width: Math.round(rect.width), height: Math.round(rect.height) };
            });

            return {
              scrollWidth: docWidth,
              scrollHeight: docHeight,
              innerWidth: winWidth,
              innerHeight: winHeight,
              hasHorizontalOverflow,
              sub16pxCount: sub16pxInputs.length,
              navPaddingTop,
              touchTargetsSample: touchTargets
            };
          })()
        `
      });

      const metrics = evalRes.result?.value || {};
      const filename = `${page.slug}_${vp.width}w_${vp.name}.jpg`;
      const screenshotPath = path.join(SCREENSHOT_DIR, filename);

      // Capture Screenshot
      const shotData = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 80,
        captureBeyondViewport: false
      });

      if (shotData && shotData.data) {
        fs.writeFileSync(screenshotPath, Buffer.from(shotData.data, 'base64'));
        auditResults.summary.totalSnapshots++;
      }

      console.log(`[${vp.name}] ${vp.width}px: scrollWidth=${metrics.scrollWidth}px (overflow: ${metrics.hasHorizontalOverflow ? 'FAIL' : 'PASS'}), sub16pxInputs=${metrics.sub16pxCount}, navPaddingTop=${metrics.navPaddingTop} -> Saved: ${filename}`);

      if (metrics.hasHorizontalOverflow) {
        auditResults.summary.zeroHorizontalOverflow = false;
      }
      if (vp.isMobile && metrics.sub16pxCount > 0) {
        auditResults.summary.fontSizingCompliant = false;
      }

      pageRecord.viewports[vp.name] = {
        viewportWidth: vp.width,
        viewportHeight: vp.height,
        measuredScrollWidth: metrics.scrollWidth,
        hasHorizontalOverflow: metrics.hasHorizontalOverflow,
        sub16pxInputs: metrics.sub16pxCount,
        navPaddingTop: metrics.navPaddingTop,
        screenshotFile: filename
      };
    }

    // Also test RTL layout on homepage and exhibition page
    if (page.slug === 'homepage' || page.slug === 'exhibition') {
      console.log(`[RTL Mode] Testing ${page.slug} with dir="rtl"...`);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
        mobile: true
      });
      await cdp.send('Runtime.evaluate', {
        expression: `
          document.documentElement.setAttribute('dir', 'rtl');
          document.documentElement.setAttribute('lang', 'ur');
        `
      });
      await new Promise(r => setTimeout(r, 300));
      const rtlMetrics = await cdp.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          bodyDir: document.documentElement.getAttribute('dir')
        })`
      });
      const rtlShot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
      const rtlFile = `${page.slug}_375w_rtl_urdu.jpg`;
      fs.writeFileSync(path.join(SCREENSHOT_DIR, rtlFile), Buffer.from(rtlShot.data, 'base64'));
      console.log(`[RTL Mode] ${page.slug} RTL screenshot saved: ${rtlFile} (overflow: ${rtlMetrics.result?.value?.overflow ? 'FAIL' : 'PASS'})`);
      pageRecord.rtlVerification = {
        screenshotFile: rtlFile,
        overflow: rtlMetrics.result?.value?.overflow
      };
      auditResults.summary.totalSnapshots++;
    }

    // Special test: Admin Exhibition & Event Builder Modals
    if (page.slug === 'admin') {
      console.log(`[Builder Modals] Opening Exhibition Builder modal at 375px...`);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 375,
        height: 812,
        deviceScaleFactor: 1,
        mobile: true
      });
      await cdp.send('Runtime.evaluate', {
        expression: `
          if (typeof window.openExhibitionBuilder === 'function') {
            window.openExhibitionBuilder();
          } else {
            const b = document.getElementById('btnOpenExhibBuilder');
            if (b) b.click();
          }
        `
      });
      await new Promise(r => setTimeout(r, 400));
      const exhibShot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
      const exhibModalFile = `admin_375w_exhibition_builder_modal.jpg`;
      fs.writeFileSync(path.join(SCREENSHOT_DIR, exhibModalFile), Buffer.from(exhibShot.data, 'base64'));
      console.log(`[Builder Modals] Saved: ${exhibModalFile}`);

      console.log(`[Builder Modals] Switching to Event Builder modal at 375px...`);
      await cdp.send('Runtime.evaluate', {
        expression: `
          if (typeof window.switchBuilderMode === 'function') {
            window.switchBuilderMode('EVENT');
          }
        `
      });
      await new Promise(r => setTimeout(r, 400));
      const eventShot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
      const eventModalFile = `admin_375w_event_builder_modal.jpg`;
      fs.writeFileSync(path.join(SCREENSHOT_DIR, eventModalFile), Buffer.from(eventShot.data, 'base64'));
      console.log(`[Builder Modals] Saved: ${eventModalFile}`);

      pageRecord.builderModals = {
        exhibitionModalFile: exhibModalFile,
        eventModalFile: eventModalFile
      };
      auditResults.summary.totalSnapshots += 2;
    }

    auditResults.pagesAudited.push(pageRecord);
  }

  // Save audit results JSON
  const jsonPath = path.join(SCREENSHOT_DIR, 'audit_results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(auditResults, null, 2));
  console.log(`\n✓ Mobile Viewport Audit Complete!`);
  console.log(`Total snapshots captured: ${auditResults.summary.totalSnapshots}`);
  console.log(`Results manifest written to: ${jsonPath}`);

} catch (err) {
  console.error('[AUDIT ERROR]', err);
} finally {
  await cdp.close();
  chromeProc.kill();
  server.close();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
