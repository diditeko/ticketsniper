/**
 * scan.js — Open the event page and list all ticket categories.
 * Usage: node scan.js
 * Use this BEFORE setting TIKET_CATEGORY in .env so you can see the exact names.
 */

require('dotenv').config();
const { getLaunchContext } = require('./session');
const logger = require('./logger');

const TIKET_URL = process.env.TIKET_URL;

async function scan() {
  if (!TIKET_URL) {
    logger.error('TIKET_URL is not set in .env');
    process.exit(1);
  }

  logger.info(`Scanning categories on: ${TIKET_URL}`);

  const context = await getLaunchContext(false);
  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.goto(TIKET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  logger.info('Page loaded. Waiting for categories...');
  await page.waitForTimeout(3000);

  // Try clicking "Beli tiket sekarang" if present (to reach category page)
  try {
    const buyBtn = await page.$('button:has-text("Beli tiket sekarang"), button:has-text("Beli Tiket")');
    if (buyBtn) {
      await buyBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      logger.info('Clicked buy button — now on category page.');
    }
  } catch (_) {}

  // Scrape categories using deep ancestor walk (same logic as bot)
  const categories = await page.evaluate(() => {
    function isPilih(el) {
      const t = el.textContent?.trim().toUpperCase() || '';
      return t === 'PILIH' || t === 'SELECT';
    }
    const pilihBtns = Array.from(document.querySelectorAll('button, [role="button"]')).filter(isPilih);

    return pilihBtns.map((btn) => {
      const isDisabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
      // Walk up collecting text, stop when ancestor has >2 Pilih buttons
      let el = btn.parentElement;
      let foundText = '';
      for (let depth = 0; depth < 25; depth++) {
        if (!el || el === document.body) break;
        const pilihCount = Array.from(el.querySelectorAll('button, [role="button"]'))
          .filter(isPilih).length;
        if (pilihCount > 2) break;
        foundText = el.textContent?.replace(/\s+/g, ' ').trim() || '';
        el = el.parentElement;
      }
      return { text: foundText, disabled: isDisabled };
    });
  });

  if (categories.length === 0) {
    logger.warn('No categories found. Possible reasons:');
    logger.warn('  1. Tickets are not on sale yet');
    logger.warn('  2. Page structure differs — try running with HEADLESS=false and inspect manually');
    logger.warn('  3. TIKET_URL is wrong or the event is sold out');
  } else {
    console.log('\n' + '═'.repeat(70));
    console.log('  TICKET CATEGORIES FOUND');
    console.log('═'.repeat(70));
    categories.forEach((cat, i) => {
      const status = cat.disabled ? '🔴 SOLD OUT / DISABLED' : '🟢 AVAILABLE';
      console.log(`\n  [${i + 1}] ${status}`);
      console.log(`      ${cat.text.slice(0, 120)}`);
    });
    console.log('\n' + '═'.repeat(70));
    console.log('\n  Copy the category name (or part of it) into your .env:');
    console.log('  TIKET_CATEGORY=<paste name here>\n');
  }

  logger.info('Press Ctrl+C to close the browser, or it will close in 30s.');
  await page.waitForTimeout(30000);
  await context.close();
}

scan().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
