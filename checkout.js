require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const CATEGORY = process.env.TIKET_CATEGORY;
const CATEGORY_FALLBACK = process.env.TIKET_CATEGORY_FALLBACK;
const QTY = parseInt(process.env.TIKET_QTY || '1', 10);

function loadProfile() {
  const profilePath = path.join(__dirname, 'profile.json');
  if (!fs.existsSync(profilePath)) {
    throw new Error('profile.json not found. Create it based on the README.');
  }
  return JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
}

// Normalize pengunjung — handles: array (new), single object (old), numeric-key object (corrupted)
function normalizeVisitors(profile) {
  const raw = profile.pengunjung;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  // Corrupted format: { "0": {...}, "1": {...}, same_as_pemesan: true }
  const numericKeys = Object.keys(raw).filter((k) => !isNaN(Number(k)));
  if (numericKeys.length > 0) {
    return numericKeys.sort((a, b) => Number(a) - Number(b)).map((k) => raw[k]);
  }

  // Old single-object format
  return [raw];
}

/**
 * Get all Pilih buttons paired with their category name.
 */
async function discoverCategories(page) {
  await page.waitForTimeout(800);

  return page.evaluate(() => {
    function isPilih(el) {
      const t = el.textContent?.trim().toUpperCase() || '';
      return t === 'PILIH' || t === 'SELECT';
    }

    const pilihBtns = Array.from(document.querySelectorAll('button, [role="button"]')).filter(isPilih);

    return pilihBtns.map((btn) => {
      const isDisabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';

      let el = btn.parentElement;
      let foundText = '';
      for (let depth = 0; depth < 25; depth++) {
        if (!el || el === document.body) break;
        const raw = el.textContent?.replace(/\s+/g, ' ').trim() || '';
        const pilihCount = Array.from(el.querySelectorAll('button, [role="button"]'))
          .filter(isPilih).length;
        if (pilihCount > 2) break;
        foundText = raw;
        el = el.parentElement;
      }

      return { text: foundText, disabled: isDisabled };
    });
  });
}

async function findPilihIndex(page, name) {
  return page.evaluate((searchName) => {
    const search = searchName.toUpperCase();

    function isPilih(el) {
      const t = el.textContent?.trim().toUpperCase() || '';
      return t === 'PILIH' || t === 'SELECT';
    }

    const allPilih = Array.from(document.querySelectorAll('button, [role="button"]')).filter(isPilih);

    // Strategy 1: from Pilih button walk UP
    for (let i = 0; i < allPilih.length; i++) {
      const btn = allPilih[i];
      let el = btn.parentElement;
      for (let depth = 0; depth < 25; depth++) {
        if (!el || el === document.body) break;
        const pilihInAncestor = Array.from(el.querySelectorAll('button, [role="button"]'))
          .filter(isPilih).length;
        if (pilihInAncestor > 2) break;
        if (el.textContent?.toUpperCase().includes(search)) {
          return { index: i, strategy: 1, disabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true' };
        }
        el = el.parentElement;
      }
    }

    // Strategy 2: from text node walk UP, find nearest Pilih
    const allEls = Array.from(document.querySelectorAll('*'));
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const txt = el.textContent?.toUpperCase() || '';
      if (!txt.includes(search)) continue;

      let ancestor = el.parentElement;
      for (let depth = 0; depth < 25; depth++) {
        if (!ancestor || ancestor === document.body) break;
        const pilihInside = Array.from(ancestor.querySelectorAll('button, [role="button"]'))
          .filter(isPilih);
        if (pilihInside.length === 1) {
          const idx = allPilih.indexOf(pilihInside[0]);
          if (idx !== -1) {
            return {
              index: idx,
              strategy: 2,
              disabled: pilihInside[0].disabled || pilihInside[0].getAttribute('aria-disabled') === 'true',
            };
          }
        }
        ancestor = ancestor.parentElement;
      }
    }

    return null;
  }, name);
}

async function selectCategory(page) {
  logger.step('STEP 3 — Selecting ticket category...');

  const allCategories = await discoverCategories(page);
  logger.info(`Found ${allCategories.length} "Pilih" buttons on page:`);
  allCategories.forEach((c, i) => {
    const status = c.disabled ? 'SOLD OUT' : 'AVAILABLE';
    logger.info(`  [${i + 1}] ${status} | ${c.text.slice(0, 90)}`);
  });

  async function tryCategory(name) {
    logger.info(`Searching for category: "${name}"`);

    const match = await findPilihIndex(page, name);

    if (!match) {
      logger.warn(`"${name}" — not found via DOM search`);
      return false;
    }

    if (match.disabled) {
      logger.warn(`"${name}" found (strategy ${match.strategy}) but SOLD OUT / disabled`);
      return false;
    }

    const allPilih = await page.$$('button, [role="button"]');
    const pilihOnly = [];
    for (const btn of allPilih) {
      const t = (await btn.textContent()).trim().toUpperCase();
      if (t === 'PILIH' || t === 'SELECT') pilihOnly.push(btn);
    }

    const containerText = allCategories[match.index]?.text?.slice(0, 80) || '';
    logger.success(`Match found (strategy ${match.strategy}): "${containerText}"`);

    // Re-query fresh locator to avoid stale element reference
    const freshButtons = page.locator('button, [role="button"]').filter({ hasText: /^(PILIH|SELECT)$/i });
    const freshTarget = freshButtons.nth(match.index);

    await freshTarget.scrollIntoViewIfNeeded();
    await freshTarget.click();
        logger.success(`Clicked "Pilih" for "${name}"`);
    await page.waitForTimeout(700);
    return true;
  }

  let selected = await tryCategory(CATEGORY);
  if (!selected && CATEGORY_FALLBACK) {
    logger.warn(`Primary category unavailable. Trying fallback: "${CATEGORY_FALLBACK}"`);
    selected = await tryCategory(CATEGORY_FALLBACK);
  }

  if (!selected) {
    const available = allCategories
      .filter((c) => !c.disabled)
      .map((c, i) => `[${i + 1}] ${c.text.slice(0, 70)}`)
      .join('\n  ');
    throw new Error(
      `Category not found. Tried: "${CATEGORY}"${CATEGORY_FALLBACK ? `, "${CATEGORY_FALLBACK}"` : ''}.\n` +
      `Run "npm run scan" to see exact names.\n` +
      `Available (enabled):\n  ${available || 'none'}`
    );
  }
}

async function setQuantity(page) {
  logger.step(`Setting quantity to ${QTY}...`);

  const clicksNeeded = QTY - 1;
  if (clicksNeeded <= 0) {
    logger.info('Quantity is 1, no clicks needed.');
    return;
  }

  // Wait for accordion/quantity editor to fully render after "Pilih" click
  await page.waitForTimeout(1500);

  // tiket.com renders "+" as an SVG icon inside <button class="QuantityEditor_operation_button__xxx">
  // The button has NO visible "+" text — only an SVG with class "QuantityEditor_plus_icon__xxx".
  // We navigate from the SVG element up to its ancestor <button> via XPath.
  const strategies = [
    // Most specific: SVG class contains "plus_icon" (QuantityEditor_plus_icon__xxx)
    'xpath=//svg[contains(@class,"plus_icon")]/ancestor::button[1]',
    // Broader: any SVG with "plus" in its class inside a button
    'xpath=//svg[contains(@class,"plus")]/ancestor::button[1]',
    // SVG <path> with id starting with "plus-" (e.g. id="plus-tmzxt3buua")
    'xpath=//path[starts-with(@id,"plus-")]/ancestor::button[1]',
    // CSS fallback: last button inside a QuantityEditor container (+ is always the last button)
    '[class*="QuantityEditor"] button:last-of-type',
    '[class*="quantity"] button:last-of-type',
    '[class*="Quantity"] button:last-of-type',
  ];

  let plusBtn = null;

  for (const sel of strategies) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0 && await loc.isVisible()) {
        plusBtn = loc;
        logger.info(`Found "+" button via: "${sel}"`);
        break;
      }
    } catch (_) {}
  }

  if (!plusBtn) {
    const debugInfo = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('[class*="Quantity"],[class*="quantity"],[class*="counter"],[class*="Counter"]'));
      return containers.flatMap((c, ci) =>
        Array.from(c.querySelectorAll('button')).map((btn, bi) => ({
          container: ci,
          btn: bi,
          className: (btn.className || '').toString().slice(0, 80),
          visible: btn.offsetParent !== null,
          disabled: btn.disabled,
        }))
      );
    });
    logger.info(`[QTY DEBUG] Buttons in quantity containers: ${debugInfo.length}`);
    debugInfo.forEach(b =>
      logger.info(`  container[${b.container}] btn[${b.btn}] class="${b.className}" visible=${b.visible}`)
    );
    logger.warn('Could not find "+" quantity button — defaulting to 1.');
    return;
  }

  for (let i = 0; i < clicksNeeded; i++) {
    await plusBtn.click();
    await page.waitForTimeout(200);
    logger.info(`  Clicked + (${i + 1}/${clicksNeeded})`);
  }

  logger.success(`Quantity set to ${QTY}`);
  await page.waitForTimeout(300);
}

async function clickPesan(page) {
  logger.step('Clicking "Pesan" to proceed to checkout...');

  // Tunggu sampai tombol benar-benar muncul di DOM
  const pesanBtn = await page.waitForSelector(
    'button:has-text("Pesan"), button:has-text("Order"), [data-testid="btn-pesan"]',
    { timeout: 10000 }
  ).catch(() => null);

  if (!pesanBtn) {
    throw new Error('"Pesan" button not found after 10s — accordion may not have opened');
  }

  // Klik + tunggu navigasi bersamaan agar tidak miss navigation event
  try {
    await Promise.all([
      page.waitForNavigation({ 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      }),
      page.locator('button:has-text("Pesan"), button:has-text("Order")').first().click(),
    ]);
    logger.success('Clicked "Pesan" — checkout form loaded!');
  } catch (e) {
    // Kalau navigasi timeout, cek apakah URL sudah berubah
    const url = page.url();
    if (url.includes('checkout') || url.includes('order') || url.includes('booking')) {
      logger.success('Clicked "Pesan" — navigated to checkout (via URL check)');
    } else {
      logger.warn('Pesan clicked but navigation unclear — continuing anyway...');
      await page.waitForTimeout(2000);
    }
  }
}

/**
 * Fill one visitor (pengunjung) section identified by its index on the page.
 *
 * If same_as_pemesan=true  → click the N-th "Sama dengan pemesan" checkbox.
 * If same_as_pemesan=false → find the N-th visitor section container via its
 *                            KTP/NIK input anchor, then fill all fields inside it.
 */
async function fillOneVisitor(page, visitor, idx) {
  logger.info(`Visitor ${idx + 1}: ${visitor.same_as_pemesan ? '(same as pemesan)' : visitor.nama}`);

  if (visitor.same_as_pemesan) {
    const result = await page.evaluate((targetIdx) => {
      // Collect all checkboxes that live inside a "sama dengan pemesan" container
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      const sameToggles = checkboxes.filter((cb) => {
        let el = cb.parentElement;
        for (let i = 0; i < 10; i++) {
          if (!el) break;
          if (el.textContent?.toLowerCase().includes('sama dengan pemesan')) return true;
          el = el.parentElement;
        }
        return false;
      });

      if (targetIdx < sameToggles.length) {
        const cb = sameToggles[targetIdx];
        if (!cb.checked) { cb.click(); return 'clicked'; }
        return 'already-checked';
      }

      // Fallback: click any element whose own text is "sama dengan pemesan"
      const allEls = Array.from(document.querySelectorAll('*'));
      const targets = allEls.filter(el =>
        el.children.length <= 3 &&
        el.textContent?.toLowerCase().includes('sama dengan pemesan')
      );
      if (targetIdx < targets.length) { targets[targetIdx].click(); return 'element-click'; }

      return null;
    }, idx);

    logger.info(`  Toggle: ${result}`);
    await page.waitForTimeout(500);
    return;
  }

  // Manual fill — find the N-th visitor section container using KTP input as anchor
  const containerHandle = await page.evaluateHandle((targetIdx) => {
    const KTP_SEL = [
      'input[placeholder*="KTP"]', 'input[placeholder*="ktp"]',
      'input[placeholder*="NIK"]', 'input[placeholder*="nik"]',
      'input[name*="ktp"]',        'input[name*="nik"]',
      'input[name*="idNumber"]',   'input[name*="identityNumber"]',
    ].join(',');

    const ktpInputs = Array.from(document.querySelectorAll(KTP_SEL))
      .filter(el => el.offsetParent !== null);

    if (targetIdx >= ktpInputs.length) return null;
    const anchor = ktpInputs[targetIdx];

    // Walk up from the KTP input to find the section container:
    // must have >= 3 visible inputs but only 1 KTP input (so it doesn't span all sections)
    let container = anchor.parentElement;
    for (let i = 0; i < 20; i++) {
      if (!container || container === document.body) break;
      const visibleInputs = Array.from(container.querySelectorAll('input'))
        .filter(e => e.offsetParent !== null);
      const ktpCount = visibleInputs.filter(e =>
        /ktp|nik|idnumber|identitynumber/i.test((e.placeholder || '') + (e.name || ''))
      ).length;
      if (visibleInputs.length >= 3 && ktpCount === 1) break;
      container = container.parentElement;
    }

    return container || anchor.parentElement;
  }, idx);

  const isNull = await containerHandle.evaluate(el => !el);
  if (isNull) {
    logger.warn(`  Visitor ${idx + 1} section container not found`);
    return;
  }

  // Fill fields within the section container using React-compatible native setter
  await containerHandle.evaluate((container, data) => {
    function reactFill(input, value) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(input, value);
      else input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Title radio
    if (data.title) {
      for (const lbl of container.querySelectorAll('label')) {
        if (lbl.textContent?.trim() === data.title) {
          const radio = lbl.querySelector('input[type="radio"]');
          if (radio) { radio.click(); break; }
          lbl.click(); break;
        }
      }
    }

    // Nama
    const namaInput = container.querySelector(
      '[placeholder*="ama lengkap"],[placeholder*="ull name"],[name*="nama"],[name*="fullName"]'
    );
    if (namaInput && data.nama) reactFill(namaInput, data.nama);

    // Phone
    const phoneInput = container.querySelector(
      '[type="tel"],[placeholder*="onsel"],[placeholder*="hone"],[name*="phone"],[name*="telp"]'
    );
    if (phoneInput && data.phone) reactFill(phoneInput, data.phone.replace(/^0/, ''));

    // Email
    const emailInput = container.querySelector(
      '[type="email"],[placeholder*="mail"],[name*="email"]'
    );
    if (emailInput && data.email) reactFill(emailInput, data.email);

    // KTP / NIK
    const ktpInput = container.querySelector(
      '[placeholder*="KTP"],[placeholder*="ktp"],[placeholder*="NIK"],[placeholder*="nik"],' +
      '[name*="ktp"],[name*="nik"],[name*="idNumber"],[name*="identityNumber"]'
    );
    if (ktpInput && data.ktp) reactFill(ktpInput, data.ktp);
  }, visitor);

  logger.success(`  Visitor ${idx + 1} filled: ${visitor.nama}`);
  await page.waitForTimeout(300);
}

async function fillCheckoutForm(page, profile) {
  logger.step('STEP 4 — Filling checkout form...');
  const { pemesan } = profile;

  // Normalize: pengunjung can be a single object (old) or an array (new)
  const visitors = normalizeVisitors(profile);

  await page.waitForSelector('input', { timeout: 20000 });
  await page.waitForTimeout(500);

  // --- Pemesan section ---

  // 1. Title
  logger.info(`Setting pemesan title: ${pemesan.title}`);
  try {
    const labels = await page.$$('label');
    for (const lbl of labels) {
      const txt = (await lbl.textContent()).trim();
      if (txt === pemesan.title) {
        const radio = await lbl.$('input[type="radio"]');
        if (radio) { await radio.check(); break; }
        await lbl.click(); break;
      }
    }
  } catch (_) {}

  // 2. Nama lengkap (first match on page = pemesan)
  logger.info(`Filling pemesan nama: ${pemesan.nama}`);
  const namaInput = await page.$('[placeholder*="ama lengkap"], [placeholder*="ull name"], [name*="nama"], [name*="fullName"]');
  if (namaInput) {
    await namaInput.click({ clickCount: 3 });
    await namaInput.fill(pemesan.nama);
  }

  // 3. Nomor ponsel (first match on page = pemesan)
  const phone = pemesan.phone.replace(/^0/, '');
  logger.info(`Filling pemesan phone: ${phone}`);
  const phoneInput = await page.$('[type="tel"], [placeholder*="onsel"], [placeholder*="hone number"], [name*="phone"], [name*="telp"]');
  if (phoneInput) {
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.fill(phone);
  }

  // --- Visitor (pengunjung) sections ---
  // Fill as many visitor sections as min(visitors in profile, QTY)
  const count = Math.min(visitors.length, QTY);
  logger.info(`Filling ${count} visitor section(s) (QTY=${QTY}, profiles=${visitors.length})...`);

  for (let i = 0; i < count; i++) {
    await fillOneVisitor(page, visitors[i], i);
  }

  await page.waitForTimeout(400);
  logger.success('Form filled.');
}

async function submitCheckout(page) {
  logger.step('Clicking "Lanjutkan pembayaran"...');

  const urlBefore = page.url();

  const btn =
    await page.$('button:has-text("Lanjutkan pembayaran")') ||
    await page.$('button:has-text("Lanjutkan Pembayaran")') ||
    await page.$('button:has-text("Continue to payment")') ||
    await page.$('button:has-text("Continue")');

  if (!btn) throw new Error('"Lanjutkan pembayaran" button not found');

  const isDisabled = await btn.evaluate((el) => el.disabled || el.getAttribute('aria-disabled') === 'true');
  if (isDisabled) {
    logger.warn('"Lanjutkan pembayaran" is disabled — form may have validation errors');
    try {
      const errors = await page.$$eval(
        '[class*="error"], [class*="invalid"], [class*="validation"], [aria-invalid="true"]',
        (els) => els.map((e) => e.textContent?.trim()).filter(Boolean)
      );
      if (errors.length) logger.warn(`  Validation errors: ${errors.join(' | ')}`);
    } catch (_) {}
  }

  await btn.click();

  try {
    await page.waitForURL((url) => url.toString() !== urlBefore, { timeout: 10000 });
    logger.success('Navigated to next page.');
  } catch (_) {
    await page.waitForLoadState('domcontentloaded');
    const urlAfter = page.url();
    if (urlAfter === urlBefore) {
      logger.warn('URL did not change after clicking "Lanjutkan pembayaran" — possible form validation error');
      logger.warn('Check the browser window for highlighted required fields');
    }
  }
}

async function runCheckout(page) {
  const profile = loadProfile();
  await selectCategory(page);
  await setQuantity(page);
  await clickPesan(page);
  await fillCheckoutForm(page, profile);
  await submitCheckout(page);
}

if (require.main === module && process.argv.includes('--test')) {
  logger.info('Test mode — profile.json loaded:');
  console.log(JSON.stringify(loadProfile(), null, 2));
}

module.exports = { runCheckout, loadProfile };
