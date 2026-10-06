# Task: Playwright verification at 390x844 touch

**Agent:** `mobile/test` (subagent, Space Bunny Free)
**Files:** None (shell only). Evidence → `artifacts/mobile/`
**Wave:** 2 (serial)

## Exact steps

### 1. Build and serve
```bash
cd /mnt/HDD/code/weddingInvitations
npm run build
npm run preview -- --port 4173 &
PREVIEW_PID=$!
sleep 3
```

### 2. Playwright test (inline script)
Run this as a Node script with playwright-core (per AGENTS.md, no separate test suite):

```js
// test-mobile.mjs
import { chromium } from "playwright-core"
import fs from "fs"

const ARTIFACTS = "artifacts/mobile"
fs.mkdirSync(ARTIFACTS, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()

await page.goto("http://localhost:4173?name=Test%20Invitado", { waitUntil: "networkidle" })
await page.waitForSelector("#loader.is-done", { state: "attached" })

// Open envelope: swipe down on canvas
await page.mouse.move(195, 422)
await page.mouse.down()
await page.mouse.move(195, 200, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(1000)

async function shot(name) {
  await page.screenshot({ path: `${ARTIFACTS}/${name}.png`, fullPage: true })
  console.log(`[PASS] ${name}`)
}

// 1. Card front → back: single clean snap
await shot("01-card-flip")

// 2. Navigate to last back sheet (scroll twice more)
await page.mouse.wheel(0, 850)
await page.waitForTimeout(500)
await page.mouse.wheel(0, 850)
await page.waitForTimeout(500)
await shot("02-last-back-sheet")

// 3. Tiny fast flick from last sheet → should land on rings (stage 1), NOT form (stage 2)
await page.mouse.move(195, 600)
await page.mouse.down()
await page.mouse.move(195, 500, { steps: 3 })
await page.mouse.up()
await page.waitForTimeout(800)
const stage = await page.getAttribute("html", "data-stage")
if (stage === "1") console.log("[PASS] 03-tiny-flick-to-rings")
else console.log("[FAIL] 03-tiny-flick-to-rings: got stage", stage)
await shot("03-tiny-flick-to-rings")

// 4. Mid-transition swipe ignored test
// (go back to card, start transition, interrupt)
await page.goto("http://localhost:4173?name=Test%20Invitado", { waitUntil: "networkidle" })
await page.waitForSelector("#loader.is-done")
await page.mouse.move(195, 422)
await page.mouse.down()
await page.mouse.move(195, 200, { steps: 5 })
await page.waitForTimeout(100)  // mid-transition
await page.mouse.move(195, 100, { steps: 5 })  // reverse direction
await page.mouse.up()
await page.waitForTimeout(800)
const stage2 = await page.getAttribute("html", "data-stage")
if (stage2 === "0") console.log("[PASS] 04-mid-transition-ignored")
else console.log("[FAIL] 04-mid-transition-ignored: got stage", stage2)
await shot("04-mid-transition-ignored")

// 5. Bouquet: verify strip visible (navigate to stage 2)
await page.goto("http://localhost:4173?name=Test%20Invitado", { waitUntil: "networkidle" })
await page.waitForSelector("#loader.is-done")
// Fast-forward to bouquet: scroll 3 times
for (let i = 0; i < 3; i++) {
  await page.mouse.wheel(0, 850)
  await page.waitForTimeout(400)
}
await shot("05-bouquet-strip-visible")

// 6. Toolbar buttons
await page.click("#bq-prev")
await page.waitForTimeout(500)
const stage3 = await page.getAttribute("html", "data-stage")
if (stage3 === "1") console.log("[PASS] 06-bq-prev-to-rings")
else console.log("[FAIL] 06-bq-prev-to-rings: got stage", stage3)

await page.click("#bq-next")
await page.waitForTimeout(500)
const stage4 = await page.getAttribute("html", "data-stage")
if (stage4 === "3") console.log("[PASS] 07-bq-next-to-arch")
else console.log("[FAIL] 07-bq-next-to-arch: got stage", stage4)

// 8. Form scrolls internally
await page.goto("http://localhost:4173?name=Test%20Invitado", { waitUntil: "networkidle" })
await page.waitForSelector("#loader.is-done")
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 850); await page.waitForTimeout(400); }
await page.evaluate(() => document.querySelector(".bq-panel__scroll").scrollTop = 100)
await page.waitForTimeout(200)
const scrollTop = await page.evaluate(() => document.querySelector(".bq-panel__scroll").scrollTop)
if (scrollTop > 50) console.log("[PASS] 08-form-internal-scroll")
else console.log("[FAIL] 08-form-internal-scroll")

// 9. Card back link tappable (check pointer-events:auto on buttons)
const cardBackBtns = await page.evaluate(() => {
  const btns = document.querySelectorAll("#card-back .card-back__btn")
  return Array.from(btns).map(b => window.getComputedStyle(b).pointerEvents)
})
if (cardBackBtns.every(p => p === "auto")) console.log("[PASS] 09-card-back-links-tappable")
else console.log("[FAIL] 09-card-back-links-tappable:", cardBackBtns)

await browser.close()
await new Promise(r => setTimeout(r, 500))
process.exit(0)
```

Run with:
```bash
node --experimental-vm-modules test-mobile.mjs 2>&1 | tee artifacts/mobile/test-output.log
```

### 3. Desktop + reduced-motion sanity
Quick manual check or add a second context with `viewport: { width: 1280, height: 720 }` and `colorScheme: "light"` with `prefers-reduced-motion: "reduce"` emulated.

### 4. Cleanup
```bash
kill $PREVIEW_PID
```

### Output
- Screenshots in `artifacts/mobile/`
- `test-output.log` with PASS/FAIL per case
- Report summary to orchestrator

## Constraints
- Free model: `opencode-go/space-bunny-free` (unlimited).
- No file edits except creating `artifacts/mobile/`.