require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const SESSION_PATH = process.env.SESSION_PATH || './session/tiketcom';
const SESSION_STATE_FILE = path.join(SESSION_PATH, 'state.json');

async function login() {
  logger.info('Starting one-time Google login...');
  logger.info(`Session will be saved to: ${SESSION_PATH}`);

  fs.mkdirSync(SESSION_PATH, { recursive: true });

  const context = await chromium.launchPersistentContext(SESSION_PATH, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.goto('https://www.tiket.com', { waitUntil: 'domcontentloaded' });

  logger.info('Browser opened. Please log in to tiket.com using Google.');
  logger.info('Press ENTER here when you have completed login...');

  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });

  const cookies = await context.cookies();
  const storage = await page.evaluate(() => ({
    localStorage: Object.fromEntries(Object.entries(localStorage)),
    sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
  }));

  fs.writeFileSync(
    SESSION_STATE_FILE,
    JSON.stringify({ cookies, storage, savedAt: new Date().toISOString() }, null, 2)
  );

  await context.close();
  logger.success('Session saved successfully!');
  logger.info(`Session file: ${SESSION_STATE_FILE}`);
}

async function checkSession() {
  if (!fs.existsSync(SESSION_PATH)) {
    logger.error('Session directory not found. Run: npm run login');
    return false;
  }

  const context = await chromium.launchPersistentContext(SESSION_PATH, {
    headless: true,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    await page.goto('https://www.tiket.com/account', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    const url = page.url();
    const isLoggedIn = !url.includes('/login') && !url.includes('/signin');

    if (isLoggedIn) {
      logger.success('Session is valid.');
    } else {
      logger.warn('Session expired. Run: npm run login');
    }

    await context.close();
    return isLoggedIn;
  } catch (err) {
    await context.close();
    logger.error(`Session check failed: ${err.message}`);
    return false;
  }
}

async function getLaunchContext(headless = false) {
  const sessionExists = fs.existsSync(SESSION_PATH);
  if (!sessionExists) {
    throw new Error('No session found. Run: npm run login');
  }
  
  const context = await chromium.launchPersistentContext(SESSION_PATH, {
    headless,
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  return context;
}

if (require.main === module) {
  const isCheck = process.argv.includes('--check');
  if (isCheck) {
    checkSession().then((ok) => process.exit(ok ? 0 : 1));
  } else {
    login().catch((err) => {
      logger.error(err.message);
      process.exit(1);
    });
  }
}

module.exports = { login, checkSession, getLaunchContext };
