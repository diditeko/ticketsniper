require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { getLaunchContext } = require('./session');
const { waitUntilPreload, waitForSaleTime, pollForButton, waitInQueue } = require('./queue');
const { runCheckout } = require('./checkout');
const { runPayment } = require('./payment');

const TIKET_URL = process.env.TIKET_URL;
const HEADLESS = process.env.HEADLESS !== 'false';
const SESSION_PATH = process.env.SESSION_PATH || './session/tiketcom';

let _broadcast = null;
let _context = null; // module-level so cleanup() can always reach it

function setBroadcast(fn) {
  _broadcast = fn;
  logger.setWebSocketBroadcaster(fn);
}

function emit(event) {
  if (_broadcast) _broadcast(event);
}

// Close browser and remove Chromium profile lock files so the next run can start clean.
async function cleanup() {
  if (_context) {
    try { await _context.close(); } catch (_) {}
    _context = null;
  }
  // Remove stale Chromium singleton lock files (left behind after hard crash)
  const sessionDir = path.resolve(SESSION_PATH);
  for (const lockFile of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    try { fs.unlinkSync(path.join(sessionDir, lockFile)); } catch (_) {}
  }
}

async function run() {
  if (!TIKET_URL) {
    throw new Error('TIKET_URL is not set in .env');
  }

  logger.info('TicketSniper starting...');
  logger.info(`Target URL: ${TIKET_URL}`);
  emit({ type: 'status', step: 'init', message: 'Bot starting...' });

  // Phase 1: Sleep until preload time
  emit({ type: 'status', step: 'waiting', message: 'Waiting until preload time...' });
  await waitUntilPreload((remaining, saleTs) => {
    emit({ type: 'countdown', remaining, saleTs });
  });

  // Phase 2: Launch browser & open page
  logger.step('STEP 1 — Launching browser and preloading event page...');
  emit({ type: 'status', step: 'preload', message: 'Opening event page...' });

  _context = await getLaunchContext(HEADLESS === true);
  const page = await _context.newPage();

  try {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
    });

    await page.goto(TIKET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    logger.success('Event page loaded and ready.');
    emit({ type: 'status', step: 'preloaded', message: 'Event page loaded — waiting for sale time...' });

    // Phase 3: Wait for exact sale time, then poll
    await waitForSaleTime();
    emit({ type: 'status', step: 'firing', message: 'FIRE MODE — polling for buy button...' });

    const buyBtn = await pollForButton(page, _broadcast);

    // Phase 4: Click buy button (queue entry)
    logger.step('STEP 2 — Clicking buy button...');
    emit({ type: 'status', step: 'queue', message: 'Clicking buy button...' });
    await buyBtn.click();
    await page.waitForLoadState('domcontentloaded');
    logger.success('Buy button clicked — in queue / on event detail page.');

    // STEP 1B — Handle "You're in line!" virtual queue page (up to 1 hour wait)
    await waitInQueue(page, _broadcast);

    // Re-check if we need to click "Beli tiket sekarang" again on event detail
    try {
      const buySec = await page.waitForSelector(
        'button:has-text("Beli tiket sekarang"), button:has-text("Beli Tiket")',
        { timeout: 5000 }
      );
      if (buySec) {
        await buySec.click();
        await page.waitForLoadState('domcontentloaded');
        logger.success('Clicked secondary buy button on event detail page.');
      }
    } catch (_) {}

    // Phase 5: Checkout
    emit({ type: 'status', step: 'checkout', message: 'Filling checkout form...' });
    await runCheckout(page);

    // Phase 6: Payment
    emit({ type: 'status', step: 'payment', message: 'Selecting payment method...' });
    const result = await runPayment(page, _broadcast);

    emit({ type: 'status', step: 'done', message: 'Done! Check VA number.' });

    // On success: keep browser open so user can see the VA number page
    logger.info('Bot completed. Browser stays open — close it manually.');
    _context = null; // hand off ownership; don't close on next cleanup()
    return result;

  } catch (err) {
    // On error: always close browser so the profile lock is released for next run
    logger.error('Bot error — closing browser to release profile lock...');
    await cleanup();
    throw err;
  }
}

if (require.main === module) {
  run().catch((err) => {
    logger.error(`Fatal error: ${err.message}`);
    logger.error(err.stack);
    process.exit(1);
  });
}

module.exports = { run, setBroadcast, cleanup };
