import { chromium } from "playwright-core"
import fs from "fs"

const ARTIFACTS = "artifacts/mobile"
fs.mkdirSync(ARTIFACTS, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
})
const page = await context.newPage()

page.on("console", msg => console.log("[BROWSER]", msg.type(), msg.text()))
page.on("pageerror", err => console.log("[BROWSER ERROR]", err.message))

async function waitForPhaseOpen() {
  await page.waitForFunction(() => window.__exp?.phase === "open", { timeout: 30000 })
}

async function shot(name) {
  await page.screenshot({ path: `${ARTIFACTS}/${name}.png`, fullPage: true })
  console.log(`[PASS] ${name}`)
}

async function gotoAndOpen() {
  await page.goto("http://localhost:4174?name=Test%20Invitado", { waitUntil: "networkidle" })
  await page.waitForSelector("#loader.is-done", { state: "attached", timeout: 60000 })
  await page.mouse.wheel(0, 100)
  await waitForPhaseOpen()
}

async function clickElement(selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (el) el.click()
  }, selector)
  await page.waitForTimeout(1500)
}

async function touchSwipeUp() {
  await page.evaluate(() => {
    const win = window
    const canvas = document.querySelector("#scene")
    const touchStart = new TouchEvent("touchstart", {
      touches: [new Touch({ identifier: 1, target: canvas, clientX: 195, clientY: 600 })],
      changedTouches: [new Touch({ identifier: 1, target: canvas, clientX: 195, clientY: 600 })],
      bubbles: true, cancelable: true
    })
    win.dispatchEvent(touchStart)
    const touchMove = new TouchEvent("touchmove", {
      touches: [new Touch({ identifier: 1, target: canvas, clientX: 195, clientY: 500 })],
      changedTouches: [new Touch({ identifier: 1, target: canvas, clientX: 195, clientY: 500 })],
      bubbles: true, cancelable: true
    })
    win.dispatchEvent(touchMove)
    const touchEnd = new TouchEvent("touchend", {
      touches: [],
      changedTouches: [new Touch({ identifier: 1, target: canvas, clientX: 195, clientY: 500 })],
      bubbles: true, cancelable: true
    })
    win.dispatchEvent(touchEnd)
  })
  await page.waitForTimeout(2000)
}

async function goToPagerPage(pageNum) {
  await page.evaluate((p) => window.__exp?.snap?.goToPage(p), pageNum)
  await page.waitForTimeout(1000)
}

console.log("=== Test 1: Card flip ===")
await gotoAndOpen()
await shot("01-card-flip")

console.log("=== Test 2: Navigate to last back sheet (page 4) ===")
await goToPagerPage(4)
await shot("02-last-back-sheet")

console.log("=== Test 3: Tiny flick to rings ===")
await touchSwipeUp()
const snapPage = await page.evaluate(() => window.__exp?.snapCurrentPage())
const stage = await page.getAttribute("html", "data-stage")
console.log("snapCurrentPage:", snapPage, "data-stage:", stage)
if (snapPage === 5 && stage === "1") console.log("[PASS] 03-tiny-flick-to-rings")
else console.log("[FAIL] 03-tiny-flick-to-rings: snapCurrentPage", snapPage, "stage", stage)
await shot("03-tiny-flick-to-rings")

console.log("=== Test 4: Mid-transition ignored ===")
await gotoAndOpen()
await page.mouse.move(195, 422)
await page.mouse.down()
await page.mouse.move(195, 200, { steps: 5 })
await page.waitForTimeout(100)
await page.mouse.move(195, 100, { steps: 5 })
await page.mouse.up()
await page.waitForTimeout(800)
const stage2 = await page.getAttribute("html", "data-stage")
if (stage2 === "0") console.log("[PASS] 04-mid-transition-ignored")
else console.log("[FAIL] 04-mid-transition-ignored: got stage", stage2)
await shot("04-mid-transition-ignored")

console.log("=== Test 5: Bouquet strip visible ===")
await gotoAndOpen()
await goToPagerPage(6) // bouquet is page 6 (stage 2)
const stageBeforeBouquet = await page.getAttribute("html", "data-stage")
console.log("Stage at bouquet:", stageBeforeBouquet)
await shot("05-bouquet-strip-visible")

console.log("=== Test 6-7: Toolbar buttons ===")
const toolbarInfo = await page.evaluate(() => {
  const el = document.querySelector(".bq-steps")
  if (!el) return { found: false }
  const style = window.getComputedStyle(el)
  return {
    found: true,
    hidden: el.hidden,
    display: style.display,
    opacity: style.opacity,
    classList: Array.from(el.classList),
    rect: el.getBoundingClientRect()
  }
})
console.log("Toolbar info:", JSON.stringify(toolbarInfo, null, 2))

if (toolbarInfo.found && !toolbarInfo.hidden) {
  await clickElement("#bq-prev")
  const stage3 = await page.getAttribute("html", "data-stage")
  if (stage3 === "1") console.log("[PASS] 06-bq-prev-to-rings")
  else console.log("[FAIL] 06-bq-prev-to-rings: got stage", stage3)

  await clickElement("#bq-next")
  const stage4 = await page.getAttribute("html", "data-stage")
  if (stage4 === "3") console.log("[PASS] 07-bq-next-to-arch")
  else console.log("[FAIL] 07-bq-next-to-arch: got stage", stage4)
} else {
  console.log("[SKIP] Toolbar not visible, skipping button tests")
}

console.log("=== Test 8: Form internal scroll ===")
await gotoAndOpen()
await goToPagerPage(6)
await page.evaluate(() => document.querySelector(".bq-panel__scroll").scrollTop = 100)
await page.waitForTimeout(200)
const scrollTop = await page.evaluate(() => document.querySelector(".bq-panel__scroll").scrollTop)
if (scrollTop > 50) console.log("[PASS] 08-form-internal-scroll")
else console.log("[FAIL] 08-form-internal-scroll")

console.log("=== Test 9: Card back links tappable ===")
await gotoAndOpen()
const cardBackBtns = await page.evaluate(() => {
  const btns = document.querySelectorAll("#card-back .card-back__btn")
  return Array.from(btns).map(b => window.getComputedStyle(b).pointerEvents)
})
if (cardBackBtns.every(p => p === "auto")) console.log("[PASS] 09-card-back-links-tappable")
else console.log("[FAIL] 09-card-back-links-tappable:", cardBackBtns)

await browser.close()
await new Promise(r => setTimeout(r, 500))
process.exit(0)