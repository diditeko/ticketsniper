require('dotenv').config();
const logger = require('./logger');

const SALE_DATE = process.env.TIKET_SALE_DATE;
const SALE_TIME = process.env.TIKET_SALE_TIME;
const PRELOAD_SECONDS = parseInt(process.env.PRELOAD_SECONDS || '15', 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '50', 10);

function getSaleTimestamp() {
  if (!SALE_DATE || !SALE_TIME) {
    throw new Error('TIKET_SALE_DATE and TIKET_SALE_TIME must be set in .env');
  }
  const dt = new Date(`${SALE_DATE}T${SALE_TIME}+07:00`);
  if (isNaN(dt.getTime())) {
    throw new Error(`Invalid sale date/time: ${SALE_DATE} ${SALE_TIME}`);
  }
  return dt.getTime();
}

async function waitUntilPreload(onTick) {
  const saleTs = getSaleTimestamp();
  const preloadTs = saleTs - PRELOAD_SECONDS * 1000;
  const now = Date.now();

  if (now >= preloadTs) {
    logger.warn('Already past preload time — proceeding immediately.');
    return;
  }

  const waitMs = preloadTs - now;
  logger.info(`Sale opens at: ${new Date(saleTs).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
  logger.info(`Preloading at: ${new Date(preloadTs).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB (T-${PRELOAD_SECONDS}s)`);
  logger.info(`Sleeping for ${(waitMs / 1000).toFixed(1)}s...`);

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      const remaining = preloadTs - Date.now();
      if (remaining <= 0) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (onTick) onTick(remaining, saleTs);
    }, 1000);
  });

  logger.info('Preload time reached — opening event page now.');
}

async function waitForSaleTime() {
  const saleTs = getSaleTimestamp();
  const now = Date.now();

  if (now >= saleTs) {
    logger.warn('Sale time already passed — entering FIRE MODE immediately.');
    return;
  }

  const waitMs = saleTs - now;
  logger.info(`Waiting ${(waitMs / 1000).toFixed(3)}s until sale opens (T=0)...`);

  await new Promise((resolve) => setTimeout(resolve, waitMs - 10));
  logger.fire('FIRE MODE ACTIVE — Polling every ' + POLL_INTERVAL_MS + 'ms');
}

async function pollForButton(page, broadcast) {
  const SELECTORS = [
    'button:has-text("Beli tiket sekarang")',
    'button:has-text("Beli Tiket")',
    'a:has-text("Beli tiket sekarang")',
    '[data-testid="btn-buy-ticket"]',
    'button.btn-buy',
  ];

  return new Promise((resolve, reject) => {
    const startTs = Date.now();
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      try {
        for (const selector of SELECTORS) {
          const btn = await page.$(selector);
          if (btn) {
            const isEnabled = await btn.isEnabled();
            const isVisible = await btn.isVisible();
            if (isEnabled && isVisible) {
              clearInterval(interval);
              const elapsed = Date.now() - startTs;
              logger.fire(`Button found! Selector: "${selector}" after ${elapsed}ms (${attempts} polls)`);
              if (broadcast) broadcast({ type: 'status', step: 'queue', message: `Button detected in ${elapsed}ms`, elapsed });
              resolve(btn);
              return;
            }
          }
        }
      } catch (err) {
        if (err.message.includes('Target closed')) {
          clearInterval(interval);
          reject(new Error('Page closed unexpectedly'));
        }
      }
    }, POLL_INTERVAL_MS);

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Timeout: buy button not found after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

/**
 * STEP 1B — Detect and wait through the "You're in line!" queue page.
 *
 * tiket.com auto-refreshes the queue page on its own schedule.
 * Bot does NOTHING except keep the browser open and watch for the redirect.
 * When queue position reaches 0, tiket.com auto-redirects to the event page.
 *
 * @param {import('playwright').Page} page
 * @param {Function} broadcast - WebSocket broadcast function
 */
async function waitInQueue(page, broadcast) {
  // Detect if we're actually on the queue page
  const onQueue = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    const url  = window.location.href;
    return (
      body.includes("You're in line") ||
      body.includes('people in front of you') ||
      url.includes('queue') ||
      url.includes('waiting-room') ||
      url.includes('antrian')
    );
  });

  if (!onQueue) return; // not a queue page, nothing to do

  logger.info('─────────────────────────────────────────');
  logger.info('STEP 1B — Virtual queue detected');
  logger.info('"You\'re in line!" — waiting for redirect...');
  logger.info('DO NOT close the browser or navigate away.');
  logger.info('─────────────────────────────────────────');

  if (broadcast) broadcast({ type: 'status', step: 'in_queue', message: 'In virtual queue — waiting for turn...' });

  // Periodically read and log queue position + ETA from the page
  const statusInterval = setInterval(async () => {
    try {
      const info = await page.evaluate(() => {
        const body = document.body?.innerText || '';

        const posMatch  = body.match(/([\d,.]+)\s*people in front of you/i);
        const etaMatch  = body.match(/Expected arrival time[^:]*:\s*(.+)/i);
        const lastMatch = body.match(/Status last updated[^:]*:\s*(.+)/i);

        return {
          position: posMatch  ? posMatch[1].trim()  : null,
          eta:      etaMatch  ? etaMatch[1].trim()  : null,
          lastUpd:  lastMatch ? lastMatch[1].trim()  : null,
        };
      });

      if (info.position) {
        logger.info(`Queue: ${info.position} people ahead | ETA: ${info.eta || '?'} | Updated: ${info.lastUpd || '?'}`);
        if (broadcast) {
          broadcast({
            type:     'queue_status',
            position: info.position,
            eta:      info.eta,
            lastUpd:  info.lastUpd,
          });
        }
      }
    } catch (_) {
      // page may be navigating — ignore
    }
  }, 15000); // log every 15s (page self-refreshes on tiket.com schedule)

  // Wait for tiket.com to redirect away from the queue page (up to 1 hour)
  try {
    await page.waitForFunction(
      () => {
        const url  = window.location.href;
        const body = document.body?.innerText || '';
        return (
          !url.includes('queue') &&
          !url.includes('waiting-room') &&
          !url.includes('antrian') &&
          !body.includes("You're in line") &&
          !body.includes('people in front of you')
        );
      },
      { timeout: 60 * 60 * 1000, polling: 2000 }
    );
  } finally {
    clearInterval(statusInterval);
  }

  logger.success('Queue passed! Redirected to event page.');
  if (broadcast) broadcast({ type: 'status', step: 'queue_done', message: 'Queue passed — proceeding to checkout' });
  await page.waitForTimeout(500);
}

module.exports = {
  getSaleTimestamp,
  waitUntilPreload,
  waitForSaleTime,
  pollForButton,
  waitInQueue,
  POLL_INTERVAL_MS,
  PRELOAD_SECONDS,
};
