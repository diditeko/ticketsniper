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