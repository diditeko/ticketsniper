# TicketSniper 🎯
### Automated Ticket Buyer for tiket.com — Millisecond Queue Entry

---

## Project Overview

TicketSniper is a browser automation bot built with **Node.js + Playwright** that automatically purchases concert/event tickets on tiket.com the moment they go on sale. The core purpose is to enter the queue in **milliseconds** — faster than any human can react — by pre-loading the page and firing the moment the sale opens.

The user configures everything once (URL, time, personal data), does a one-time Google login, and the bot handles everything from queue entry to displaying the Virtual Account payment number.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE                        │
│              Web Dashboard (React + Vite)                │
│   [Paste URL] [Set Date/Time] [Select Category] [Qty]   │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API + WebSocket (real-time log)
┌─────────────────────▼───────────────────────────────────┐
│                   BOT ENGINE                             │
│               Node.js + Playwright                       │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  Session │  │  Timer   │  │ Auto-Fill│  │Payment │  │
│  │ Manager  │  │  Engine  │  │  Module  │  │ Module │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │ Playwright (Chromium)
┌─────────────────────▼───────────────────────────────────┐
│                  tiket.com                               │
│  Queue Page → Event Page → Category → Form → Payment    │
└─────────────────────────────────────────────────────────┘
```

### Key Files

```
ticketsniper/
├── bot.js               # Main engine — orchestrates all steps
├── session.js           # Google login & cookie persistence
├── queue.js             # Millisecond timer & queue entry logic
├── checkout.js          # Auto-fill form from profile.json
├── payment.js           # Select payment method & confirm
├── profile.json         # User personal data (auto-fill source)
├── .env                 # Bot configuration (URL, time, category)
├── session/             # Saved Playwright browser session (cookies)
│   └── tiketcom/        # Persistent Chrome profile dir
├── logs/                # Screenshots & run logs
└── package.json
```

---

## Configuration Files

### `.env` — Bot Target Configuration

```env
# ── Target Event ──────────────────────────────────────
TIKET_URL=https://www.tiket.com/konser/nama-event
TIKET_SALE_DATE=2026-05-10
TIKET_SALE_TIME=10:00:00        # WIB format HH:MM:SS — this is the exact moment bot fires

# ── Ticket Preferences ────────────────────────────────
TIKET_CATEGORY=CAT 1A           # Must match EXACTLY as shown on tiket.com
TIKET_CATEGORY_FALLBACK=CAT 2   # Used if primary category is sold out
TIKET_QTY=2                     # Number of tickets (controls how many times bot clicks +)

# ── Timing Settings ───────────────────────────────────
PRELOAD_SECONDS=15              # Bot opens page N seconds before sale opens
POLL_INTERVAL_MS=50             # How often bot checks if buy button is active (ms)

# ── Browser Settings ──────────────────────────────────
HEADLESS=false                  # false = Chrome visible (safer, harder to detect)
SESSION_PATH=./session/tiketcom # Where to store login cookies

# ── Payment ───────────────────────────────────────────
PAYMENT_METHOD=mandiri_va       # mandiri_va / bca_va / cc / gopay / ovo
```

### `profile.json` — User Personal Data (Auto-Fill Source)

This file is the single source of truth for all form fields on tiket.com.
The bot reads this file and auto-fills every input field on the checkout page.

```json
{
  "pemesan": {
    "title": "Tuan",
    "nama": "Andi Saputra",
    "phone": "081234567890",
    "email": "andi@gmail.com",
    "negara": "Indonesia"
  },
  "pengunjung": {
    "same_as_pemesan": false,
    "title": "Tuan",
    "nama": "Andi Saputra",
    "phone": "081234567890",
    "email": "andi@gmail.com",
    "ktp": "3271234567890001"
  },
  "payment": {
    "method": "mandiri_va"
  }
}
```

> **Note:** If `same_as_pemesan` is `true`, the bot will click the toggle
> "Sama dengan pemesan" on the form instead of filling the visitor section manually.

---

## Complete Flow — Step by Step

### PRE-REQUISITE: One-Time Google Login

Before the bot can run, the user must complete a **one-time manual login** to tiket.com using Google.

**Why manual?** Google OAuth has protections that prevent automated login. The solution is:
1. Bot opens a visible Chrome browser (not headless)
2. User logs in to tiket.com with Google normally
3. Playwright saves the entire session (cookies + localStorage) to `./session/tiketcom/`
4. All future bot runs reuse this saved session — no login needed again

**Command:**
```bash
npm run login
# Chrome opens → login with Google → press Enter in terminal when done
```

The session is saved permanently. It only needs to be redone if the session expires or the user logs out.

**Flow confirmed:** tiket.com requires login BEFORE entering the queue (not after), so the session must be ready before the bot fires at sale time.

---

### STEP 1 — Queue Entry (Millisecond Precision)

**Goal:** Enter the ticket queue as fast as humanly (bot-ly) possible the moment sale opens.

**How it works:**

```
T - 15s  → Bot opens the event URL (pre-load)
            Page is fully loaded, DOM ready, session active

T - 0.05s → FIRE MODE: bot polls for active buy button every 50ms

T = 0     → Sale opens on tiket.com server

T + ~30ms → Bot detects button state change, fires click immediately

T + ~50ms → Bot is in queue
```

**Implementation details:**
- Bot uses `setInterval` with `POLL_INTERVAL_MS` (default 50ms) to continuously check if the queue/buy button becomes active
- The page is pre-loaded `PRELOAD_SECONDS` before sale time so there is zero page-load delay at T=0
- Bot hides webdriver fingerprint to avoid detection:
  ```js
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  ```
- Chromium is launched using `launchPersistentContext` with the saved session path so cookies are automatically included

**Target element:** The queue entry button or "Beli tiket sekarang" button that becomes active at sale time.

---

### STEP 1B — Waiting in Queue ("You're in line!" Page)
 
**Goal:** Stay alive on the queue page and wait for tiket.com to automatically redirect the bot when its turn arrives. The bot does NOTHING here except keep the browser open.
 
**What this page looks like:**
```
"You're in line!"
[Event Name] — Live in Indonesia
 
When it's your turn, your screen will be refreshed automatically,
and you may begin to book the tickets.
 
You'll have 10 minutes to select your tickets and complete the
order form. So, get your ID (NIK or passport number) ready to
speed up the booking process.
 
        15.998
   people in front of you
 
Expected arrival time on the website: 1:54 PM
Status last updated: 1:00:43 PM
```
 
**Key behaviour to understand:**
- After bot enters the queue at T+~50ms, tiket.com redirects to this "You're in line!" page automatically
- The page **auto-refreshes itself** — tiket.com controls this, NOT the bot
- When the bot's turn arrives, tiket.com **automatically redirects** to the event page
- Bot simply waits and watches for the redirect — no clicking needed
**Bot behaviour on this page:**
```
Bot lands on "You're in line!" page
        ↓
Bot watches for URL change / page redirect (waitForNavigation)
        ↓
tiket.com auto-refreshes page periodically, updating queue position
        ↓
When position reaches 0 → tiket.com redirects to event page
        ↓
Bot detects navigation → immediately proceeds to STEP 2
```
 
**Why entering queue fast matters:**
The "people in front of you" number directly determines how long you wait.
Entering at T+30ms vs T+3000ms (human reaction time) could mean the difference
between position #500 and position #15,998 — potentially hours of wait vs seconds.
 
**Implementation:**
```js
// Bot waits for tiket.com to redirect away from queue page
await page.waitForFunction(() => {
  return !window.location.href.includes('queue') &&
         !document.body.innerText.includes("You're in line");
}, { timeout: 60 * 60 * 1000 }); // wait up to 1 hour
```
 
> ⚠️ **Important:** The bot must keep the browser session alive during the entire
> wait. Do NOT close the browser or navigate away — this loses the queue position.
> The computer must stay awake and connected to the internet throughout.
 
---

### STEP 2 — Event Page: Click "Beli tiket sekarang"

**Goal:** After exiting the queue, bot lands on the event detail page and immediately clicks the buy button.

**Page layout (from screenshot):**
- Event title, date, venue info on the left
- Right side panel shows: "Tiket tersedia, beli sebelum kehabisan!"
- Blue button: **"Beli tiket sekarang"**

**Bot action:**
```js
await page.click('button:has-text("Beli tiket sekarang")');
```

The button text is unambiguous, so selector targeting is straightforward.
Bot does NOT wait for user input here — it clicks immediately after detecting the page.

---

### STEP 3 — Category Selection: "Pilih" → Set Qty → "Pesan"

**Goal:** Select the target ticket category, set the correct quantity, and proceed to checkout.

**Page layout (from screenshot):**
- Left panel: list of categories (VIP A, VIP B, CAT 1, CAT 2, etc.) each with a "Pilih" button
- Right panel: venue site map + category availability list with remaining ticket count
- When "Pilih" is clicked on a category: accordion expands showing date, time slot, and quantity selector

**Important:** Tanggal (date) and Slot Waktu (time slot) are **automatically pre-selected by tiket.com** — the bot does NOT need to interact with these fields.

**Bot actions (3 actions only):**

```
Action 1 → Find and click "Pilih" button for the configured TIKET_CATEGORY
           e.g. find element containing "CAT 1A" and click its "Pilih" button

Action 2 → Click the "+" button (TIKET_QTY - 1) times to set quantity
           e.g. if qty = 2, click "+" once (default starts at 1)

Action 3 → Click "Pesan" button to proceed to checkout form
```

**Fallback logic:** Before clicking "Pilih", bot checks the right panel for remaining ticket count. If the target category shows `0`, bot automatically tries `TIKET_CATEGORY_FALLBACK` instead.

---

### STEP 4 — Auto-Fill Checkout Form

**Goal:** Fill in all personal data fields automatically from `profile.json` and click "Lanjutkan pembayaran".

**Page has two sections (from screenshot):**

**Section A — Detail Pemesanan (Order Details):**

| Field | Source | Bot Action |
|---|---|---|
| Title (Tuan/Nyonya/Nona) | `profile.json > pemesan.title` | Click radio button |
| Nama lengkap | `profile.json > pemesan.nama` | Type into input |
| Nomor ponsel | `profile.json > pemesan.phone` | Type (strip leading 0, +62 already shown) |
| Alamat email | Auto-filled from Google session | **SKIP** — already populated |
| Negara tempat tinggal | `profile.json > pemesan.negara` | Select dropdown |

**Section B — Detail Pengunjung (Visitor Details):**

If `same_as_pemesan = true`:
```
Bot clicks toggle "Sama dengan pemesan" → section collapses → done
```

If `same_as_pemesan = false`:

| Field | Source | Bot Action |
|---|---|---|
| Title | `profile.json > pengunjung.title` | Click radio button |
| Nama lengkap | `profile.json > pengunjung.nama` | Type into input |
| Nomor Ponsel | `profile.json > pengunjung.phone` | Type into input |
| Email | `profile.json > pengunjung.email` | Type into input |
| Nomor KTP | `profile.json > pengunjung.ktp` | Type 16-digit NIK |

**Final action:**
```js
await page.click('button:has-text("Lanjutkan pembayaran")');
```

> ⚠️ **reCAPTCHA Note:** The page footer shows "Halaman ini dilindungi oleh reCAPTCHA".
> This is Google's invisible reCAPTCHA v3 (score-based, no challenge shown to user).
> Since the bot uses a real Chrome profile with a genuine Google session, the risk score
> should be low. However, if challenges appear, the bot should pause and alert the user.

---

### STEP 5 — Payment: Select Mandiri VA → Get VA Number (FINAL STEP)

**Goal:** Select Mandiri Virtual Account as payment method, confirm, and display the VA number to the user. The bot stops here — payment is done manually by the user.

**Page layout (from screenshot):**
- Progress bar: `Pilih Metode → Bayar → Selesai`
- Countdown timer (e.g., `00:09:13`) — user must complete payment before this expires
- Payment options: Kartu Kredit/Debit, BCA Virtual Account, **Mandiri Virtual Account**
- "Lihat semua" to expand more options
- Right panel: Order summary + "Bayar dengan Virtual Account" blue button

**Bot actions:**
```
Action 1 → Click radio button next to "Mandiri Virtual Account"
Action 2 → Click "Bayar dengan Virtual Account"
```

**Result page (from screenshot):**
- Instruksi Pembayaran page appears
- VA Number displayed: `8783 1013 4389 8306`
- Total Pembayaran: `IDR 3.350.000`
- Deadline: e.g., `Sen, 20 Apr 2026, 01.54 WIB`

**Bot behavior at this point:**
- Bot takes a screenshot and saves to `./logs/va_number.png`
- Bot logs the VA number and deadline to terminal
- Bot sends desktop notification (if supported) with the VA number
- **Bot stops. User completes payment manually via Mandiri m-banking/ATM.**

> ⚠️ **Critical Timer Warning:** From STEP 1 to VA number, the entire process must complete
> before the payment countdown expires (usually ~10 minutes). Bot speed is essential.

---

## Installation & Setup

### Requirements

- Node.js 18+
- npm
- macOS / Windows / Linux

### Install

```bash
git clone https://github.com/yourname/ticketsniper
cd ticketsniper
npm install
npm run install-browser    # Downloads Chromium via Playwright
```

### One-time login

```bash
npm run login
```

1. Chromium opens and navigates to tiket.com
2. Click "Masuk" → "Lanjutkan dengan Google"
3. Complete Google login as normal
4. Return to terminal and press **Enter**
5. Session saved to `./session/tiketcom/`

### Configure your data

```bash
cp .env.example .env
# Edit .env with your target event URL, date, time, category
```

```bash
# Edit profile.json with your personal data
nano profile.json
```

### Run the bot

```bash
npm start
```

The bot will:
1. Verify saved session is valid
2. Calculate time until `TIKET_SALE_TIME`
3. Sleep until `PRELOAD_SECONDS` before sale
4. Pre-load the event page
5. Enter FIRE MODE — polling every `POLL_INTERVAL_MS`
6. Execute all 5 steps automatically
7. Display VA number and stop

---

## Tech Stack

| Component | Technology |
|---|---|
| Bot engine | Node.js |
| Browser automation | Playwright (Chromium) |
| Session persistence | Playwright `launchPersistentContext` |
| Config | dotenv (`.env`) |
| Personal data | `profile.json` |
| Timing precision | `setInterval` + `Date.getTime()` |
| Bot detection evasion | `navigator.webdriver = false` patch |

---

## Known Challenges & Solutions

### 1. Google Login (OAuth)
**Problem:** Google blocks automated login attempts.
**Solution:** One-time manual login. Bot opens visible Chrome, user logs in manually. Session (cookies + storage) saved permanently to disk via `launchPersistentContext`.

### 2. Bot Detection
**Problem:** tiket.com may detect Playwright's Chromium as a bot.
**Solution:**
- Run with `HEADLESS=false` (visible browser is harder to detect)
- Inject `navigator.webdriver = false` at page init
- Use persistent Chrome profile (real browsing history, cookies)
- Avoid unnaturally fast interactions — add small delays between actions

### 3. reCAPTCHA v3
**Problem:** Checkout page is protected by invisible reCAPTCHA.
**Solution:** Since bot uses a real Google-authenticated session on a real Chrome profile, the reCAPTCHA score should remain low. If a challenge is triggered, bot pauses and notifies user to complete manually.

### 4. Dynamic Selectors
**Problem:** tiket.com may change element selectors/class names.
**Solution:** Use text-based selectors (`has-text`) and ARIA roles rather than CSS class names. Example: `button:has-text("Beli tiket sekarang")` is more resilient than `.btn-primary-blue`.

### 5. Queue System
**Problem:** tiket.com uses a virtual queue — entering it 1ms later means thousands of positions back.
**Solution:** Pre-load page before sale, poll every 50ms, fire the instant button becomes active.

---

## Important Notes

- **Do not close the terminal** while bot is running
- **Keep computer awake** — use `caffeinate` (macOS) or disable sleep
- **Check session validity** before event day by running `npm run check-session`
- **Backup `./session/tiketcom/`** — if this folder is deleted, you need to login again
- **The bot stops at VA number** — payment must be completed manually within the countdown timer
- This tool is for personal use only

---

## npm Scripts

```bash
npm run login           # One-time Google login & save session
npm run start           # Run the bot (main command)
npm run check-session   # Verify saved session is still valid
npm run test-fill       # Test auto-fill form without submitting
```
