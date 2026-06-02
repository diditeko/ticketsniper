/**
 * test-queue.js — STEP 1B integration test
 *
 * Simulates the full queue experience without a real ticket war:
 *  1. Opens Chromium with the real saved session
 *  2. Loads a mock "You're in line!" page (identical structure to tiket.com)
 *  3. Calls waitInQueue() — should detect queue and start waiting
 *  4. After REDIRECT_AFTER_SEC seconds, auto-navigates to TIKET_URL (simulating redirect)
 *  5. waitInQueue() detects the redirect and exits → test passes
 *
 * Usage:
 *   npm run test-queue
 */

require('dotenv').config();
const path = require('path');
const { chromium } = require('playwright');
const logger = require('./logger');
const { waitInQueue } = require('./queue');

const SESSION_PATH = path.resolve(process.env.SESSION_PATH || './session/tiketcom');
const TIKET_URL    = process.env.TIKET_URL || 'https://www.tiket.com';
const REDIRECT_AFTER_SEC = 10; // seconds to simulate waiting in queue

// Mock HTML — mirrors the real tiket.com queue page text markers
const MOCK_QUEUE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Queue — tiket.com (MOCK)</title>
  <style>
    body { font-family: sans-serif; max-width: 500px; margin: 80px auto; text-align: center; background: #f5f5f5; }
    .badge { background: #e0f0ff; border: 1px solid #007cff; border-radius: 8px; padding: 4px 12px; font-size: 12px; color: #007cff; margin-bottom: 24px; display: inline-block; }
    h1 { font-size: 28px; color: #111; }
    .count { font-size: 48px; font-weight: bold; color: #007cff; margin: 16px 0 4px; }
    .label { font-size: 14px; color: #555; margin-bottom: 24px; }
    .eta { font-size: 13px; color: #333; margin-bottom: 8px; }
    .updated { font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="badge">MOCK QUEUE PAGE — TEST ONLY</div>
  <h1>You're in line!</h1>
  <p>Avenged Sevenfold Live in Indonesia</p>
  <div class="count">15,998</div>
  <div class="label">people in front of you</div>
  <div class="eta">Expected arrival time on the website: 2:30 PM</div>
  <div class="updated">Status last updated: 2:00:43 PM</div>
  <p style="margin-top:32px;color:#999;font-size:12px">
    Bot will auto-redirect in ${REDIRECT_AFTER_SEC} seconds (simulating tiket.com redirect)
  </p>
</body>
</html>`;

async function runTest() {
  logger.info('');
  logger.info('╔══════════════════════════════════════╗');
  logger.info('║    STEP 1B — Queue Test Starting     ║');
  logger.info('╚══════════════════════════════════════╝');
  logger.info(`Simulated queue wait : ${REDIRECT_AFTER_SEC}s`);
  logger.info(`Redirect target      : ${TIKET_URL}`);
  logger.info('');

  const context = await chromium.launchPersistentContext(SESSION_PATH, {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await context.newPage();

  // Load mock queue page via data: URI
  await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(MOCK_QUEUE_HTML)}`);
  logger.info('Mock queue page loaded in browser.');
  logger.info(`Auto-redirecting to event URL in ${REDIRECT_AFTER_SEC}s...`);

  // Schedule the simulated redirect (like tiket.com auto-redirecting after queue)
  const redirectTimer = setTimeout(async () => {
    try {
      logger.info(`[SIM] Triggering redirect → ${TIKET_URL}`);
      await page.goto(TIKET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      logger.info('[SIM] Redirect complete');
    } catch (err) {
      logger.warn(`[SIM] Redirect error (safe to ignore): ${err.message}`);
    }
  }, REDIRECT_AFTER_SEC * 1000);

  // Run waitInQueue — this is the real production code being tested
  const mockBroadcast = (msg) => {
    if (msg.type === 'queue_status') {
      logger.info(`[WS] queue_status → position=${msg.position} eta=${msg.eta}`);
    } else {
      logger.info(`[WS] ${msg.type}: ${msg.message || ''}`);
    }
  };

  let passed = false;
  try {
    await waitInQueue(page, mockBroadcast);
    passed = true;
  } catch (err) {
    logger.warn(`waitInQueue threw: ${err.message}`);
  } finally {
    clearTimeout(redirectTimer);
  }

  if (passed) {
    logger.info('');
    logger.info('╔══════════════════════════════════════╗');
    logger.info('║   ✅  STEP 1B TEST PASSED            ║');
    logger.info('║  waitInQueue detected queue &        ║');
    logger.info('║  exited cleanly after redirect.      ║');
    logger.info('╚══════════════════════════════════════╝');
  } else {
    logger.info('');
    logger.info('╔══════════════════════════════════════╗');
    logger.info('║   ❌  STEP 1B TEST FAILED            ║');
    logger.info('║  Check logs above for details.       ║');
    logger.info('╚══════════════════════════════════════╝');
  }

  await page.waitForTimeout(3000); // let user see result in browser
  await context.close();
  process.exit(passed ? 0 : 1);
}

runTest().catch((err) => {
  logger.error(`Test crashed: ${err.message}`);
  process.exit(1);
});
