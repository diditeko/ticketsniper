require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const PAYMENT_METHOD = process.env.PAYMENT_METHOD || 'mandiri_va';

const PAYMENT_MAP = {
  mandiri_va: 'Mandiri Virtual Account',
  bca_va:     'BCA Virtual Account',
  bni_va:     'BNI Virtual Account',
  bri_va:     'BRI Virtual Account',
  gopay:      'GoPay',
  ovo:        'OVO',
  cc:         'Kartu Kredit',
};

// ─── Action 1: click "Lihat semua ▼" to open payment modal ───────────────
async function clickLihatSemua(page) {
  logger.info('Action 1 — clicking "Lihat semua" to open payment modal...');

  // Try every possible variant: "Lihat semua", "Lihat Semua", "Lihat semua ▼", link/button/span
  const found = await page.evaluate(() => {
    const keywords = ['lihat semua', 'see all', 'show all', 'lihat semua ▼'];
    const allEls = Array.from(document.querySelectorAll('a, button, span, p, div'));
    for (const el of allEls) {
      const txt = el.textContent?.trim().toLowerCase() || '';
      if (keywords.some((kw) => txt === kw || txt.startsWith(kw))) {
        el.click();
        return el.textContent?.trim();
      }
    }
    return null;
  });

  if (found) {
    logger.success(`Clicked "${found}"`);
    await page.waitForTimeout(2000);
    return true;
  }

  // Playwright locator fallback with partial match
  try {
    await page.locator('text=/lihat semua/i').first().click({ timeout: 5000 });
    logger.success('Clicked "Lihat semua" via locator');
    await page.waitForTimeout(2000);
    return true;
  } catch (_) {}

  logger.warn('"Lihat semua" not found — trying to proceed without it');
  return false;
}

// ─── Action 2: wait for modal, then click the payment card ────────────────
async function clickPaymentInModal(page, label) {
  logger.info(`Action 2 — waiting for modal and clicking "${label}"...`);

  // Wait for modal to appear — detect by heading text or dialog role
  try {
    await page.waitForFunction(
      () => document.body.innerText.toLowerCase().includes('pilih metode pembayaran'),
      { timeout: 6000 }
    );
    logger.success('Payment modal detected');
  } catch (_) {
    logger.warn('Modal heading not detected — trying to find payment option anyway');
  }
  await page.waitForTimeout(400);

  // Click the card whose text matches the payment label
  // The card may contain an image + text, so match by partial text
  const clicked = await page.evaluate((targetLabel) => {
    const search = targetLabel.toLowerCase();
    // Walk all elements, prefer those inside a modal/dialog
    const scope =
      document.querySelector('[role="dialog"]') ||
      document.querySelector('[class*="modal"]') ||
      document.querySelector('[class*="popup"]') ||
      document.body;

    const allEls = Array.from(scope.querySelectorAll('*'));
    for (const el of allEls) {
      const txt = el.textContent?.trim().toLowerCase() || '';
      if (txt === search) {
        // Found exact match — click nearest card ancestor
        const card =
          el.closest('[class*="card"], [class*="item"], [class*="option"], [class*="method"]') ||
          el.closest('li') ||
          el.parentElement;
        if (card) { card.click(); return `card:${el.textContent.trim()}`; }
        el.click();
        return `el:${el.textContent.trim()}`;
      }
    }
    // Partial match fallback
    for (const el of allEls) {
      const txt = el.textContent?.trim().toLowerCase() || '';
      if (txt.includes(search) && el.children.length <= 4) {
        const card =
          el.closest('[class*="card"], [class*="item"], [class*="option"]') ||
          el.closest('li') ||
          el.parentElement;
        if (card) { card.click(); return `partial-card:${el.textContent.trim().slice(0, 40)}`; }
        el.click();
        return `partial-el:${el.textContent.trim().slice(0, 40)}`;
      }
    }
    return null;
  }, label);

  if (clicked) {
    logger.success(`Clicked payment option — ${clicked}`);
  } else {
    // Last resort: Playwright locator
    try {
      await page.locator(`text="${label}"`).first().click({ timeout: 5000 });
      logger.success(`Clicked "${label}" via locator`);
    } catch (_) {
      throw new Error(`Payment option "${label}" not found in modal. Check PAYMENT_METHOD in .env`);
    }
  }

  // Wait for modal to close (popup auto-dismisses after selection)
  try {
    await page.waitForFunction(
      () => !document.body.innerText.toLowerCase().includes('pilih metode pembayaran'),
      { timeout: 4000 }
    );
    logger.success('Modal closed after selection');
  } catch (_) {
    logger.info('Modal may still be open — continuing');
  }

  await page.waitForTimeout(400);
}

async function selectPaymentMethod(page) {
  logger.step('STEP 5 — Selecting payment method...');

  const label = PAYMENT_MAP[PAYMENT_METHOD];
  if (!label) throw new Error(`Unknown payment method: ${PAYMENT_METHOD}`);
  logger.info(`Target: "${label}"`);

  await clickLihatSemua(page);        // Action 1
  await clickPaymentInModal(page, label);  // Action 2
  // Action 3 (Bayar dengan Virtual Account) is handled by confirmPayment()
}

async function confirmPayment(page) {
  logger.step('Confirming payment...');

  const payBtn =
    await page.$('button:has-text("Bayar dengan Virtual Account")') ||
    await page.$('button:has-text("Bayar Sekarang")') ||
    await page.$('button:has-text("Konfirmasi")') ||
    await page.$('button:has-text("Lanjutkan")') ||
    await page.$('[data-testid="btn-pay"]');

  if (!payBtn) throw new Error('Payment confirm button not found');

  await payBtn.click();
  logger.success('Payment confirmed — waiting for VA number page...');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

async function extractVANumber(page) {
  logger.step('Extracting VA number...');

  // Wait for confirmation page
  await page.waitForSelector('text=/[0-9]{4}\\s[0-9]{4}/', { timeout: 15000 }).catch(() => {});

  const vaSelectors = [
    '[class*="va-number"]',
    '[class*="virtual-account"]',
    '[data-testid="va-number"]',
    'text=/\\d{4}\\s\\d{4}\\s\\d{4}\\s\\d{4}/',
    'text=/\\d{16}/',
  ];

  let vaNumber = null;

  for (const sel of vaSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        const text = await el.textContent();
        const clean = text?.replace(/\s+/g, ' ').trim();
        if (clean && /[\d\s]{14,}/.test(clean)) {
          vaNumber = clean;
          break;
        }
      }
    } catch (_) {}
  }

  if (!vaNumber) {
    const bodyText = await page.textContent('body');
    const match = bodyText.match(/\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{0,4})\b/);
    if (match) vaNumber = match[1];
  }

  return vaNumber;
}

async function extractDeadline(page) {
  try {
    const found = await page.evaluate(() => {
      // innerText is safe — it returns empty string for <script>/<style> elements.
      // Never use textContent here; it reads raw script source code.
      const SKIP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'NOSCRIPT', 'SVG']);
      const all = Array.from(document.querySelectorAll('*'))
        .filter(el => !SKIP.has(el.tagName));

      const keywords = ['deadline', 'expire', 'batas waktu', 'bayar sebelum',
                        'selesaikan sebelum', 'berlaku sampai', 'valid until', 'payment deadline'];

      // Pass 1: label + date/time in same element (under 200 chars to avoid containers)
      for (const el of all) {
        if (el.children.length > 3) continue;
        const txt = (el.innerText || '').trim();
        if (txt.length > 200 || txt.length < 3) continue;
        const lc = txt.toLowerCase();
        if (keywords.some(k => lc.includes(k)) && /\d/.test(txt)) return txt;
      }

      // Pass 2: look for a formatted deadline date next to "selesaikan" label
      for (const el of all) {
        if (el.children.length > 1) continue;
        const txt = (el.innerText || '').trim();
        if (txt.length > 80) continue;
        // Indonesian: "Sen, 10 Okt 2026" or "Sabtu, 10 Oktober 2026, 01.54 WIB"
        if (/^(Sen|Sel|Rab|Kam|Jum|Sab|Min)[a-z]*[,.]?\s*\d/.test(txt)) return txt;
        // English: "Mon, 10 Oct 2026"
        if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,.]?\s*\d/.test(txt)) return txt;
      }

      // Pass 3: countdown timer (HH:MM:SS or MM:SS)
      for (const el of all) {
        if (el.children.length > 1) continue;
        const txt = (el.innerText || '').trim();
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(txt)) return txt;
      }

      return null;
    });

    if (found) return found;
  } catch (_) {}

  // Fallback: 10 minutes from now
  const deadline = new Date(Date.now() + 10 * 60 * 1000);
  return deadline.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB (±10 menit)';
}

async function extractTotal(page) {
  try {
    const found = await page.evaluate(() => {
      const SKIP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'NOSCRIPT', 'SVG']);
      const all = Array.from(document.querySelectorAll('*'))
        .filter(el => !SKIP.has(el.tagName));

      // Pass 1: find "Total Pembayaran" label, then grab the sibling/adjacent amount
      for (const el of all) {
        if (el.children.length > 2) continue;
        const txt = (el.innerText || '').trim().toLowerCase();
        if (txt !== 'total pembayaran' && txt !== 'total payment') continue;

        // Check next sibling
        let sib = el.nextElementSibling;
        for (let i = 0; i < 5 && sib; i++) {
          const sibTxt = (sib.innerText || '').trim();
          if (/(IDR|Rp)\s?[\d.,]+/.test(sibTxt) && sibTxt.length < 30) return sibTxt;
          sib = sib.nextElementSibling;
        }
        // Check parent's children
        if (el.parentElement) {
          for (const child of el.parentElement.children) {
            const childTxt = (child.innerText || '').trim();
            if (/(IDR|Rp)\s?[\d.,]+/.test(childTxt) && childTxt.length < 30 && child !== el) return childTxt;
          }
        }
      }

      // Pass 2: find a leaf element whose entire text is ONLY an IDR/Rp amount
      for (const el of all) {
        if (el.children.length > 0) continue;
        const txt = (el.innerText || '').trim();
        if (/^(IDR|Rp)\s?[\d.,]+$/.test(txt)) return txt;
      }

      // Pass 3: any short element containing an IDR/Rp amount
      for (const el of all) {
        if (el.children.length > 1) continue;
        const txt = (el.innerText || '').trim();
        if (txt.length < 20 && /(IDR|Rp)\s?[\d.,]+/.test(txt)) return txt;
      }

      return null;
    });

    if (found) return found.trim();
  } catch (_) {}
  return null;
}

async function saveScreenshot(page, filename) {
  const logDir = path.join(__dirname, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const filePath = path.join(logDir, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  logger.success(`Screenshot saved: ${filePath}`);
  return filePath;
}

async function notifyUser(vaNumber, total, deadline) {
  try {
    const notifier = require('node-notifier');
    notifier.notify({
      title: 'TicketSniper ✅',
      message: `VA: ${vaNumber}\nTotal: ${total}\nDeadline: ${deadline}`,
      sound: true,
    });
  } catch (_) {}
}

async function runPayment(page, broadcast) {
  await selectPaymentMethod(page);
  await confirmPayment(page);

  const [vaNumber, deadline, total] = await Promise.all([
    extractVANumber(page),
    extractDeadline(page),
    extractTotal(page),
  ]);

  const screenshotPath = await saveScreenshot(page, `va_number_${Date.now()}.png`);

  // Safety: truncate values so WebSocket message is never oversized
  const safeTotal    = (total    || '').slice(0, 100) || 'see screenshot';
  const safeDeadline = (deadline || '').slice(0, 100) || 'see screenshot';

  logger.success('═══════════════════════════════════');
  logger.success('          TICKET PURCHASED!         ');
  logger.success('═══════════════════════════════════');
  logger.success(`VA Number : ${vaNumber || 'see screenshot'}`);
  logger.success(`Total     : ${safeTotal}`);
  logger.success(`Deadline  : ${safeDeadline}`);
  logger.success(`Screenshot: ${screenshotPath}`);
  logger.success('═══════════════════════════════════');
  logger.warn('Complete payment manually before deadline!');

  if (broadcast) {
    broadcast({ type: 'complete', vaNumber, total: safeTotal, deadline: safeDeadline, screenshotPath });
  }

  await notifyUser(vaNumber, total, deadline);

  return { vaNumber, total, deadline, screenshotPath };
}

module.exports = { runPayment, selectPaymentMethod, confirmPayment };
