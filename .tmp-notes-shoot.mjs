import { chromium } from "playwright-core"
import fs from "fs"

const OUT = "/tmp/opencode/notes-review"
fs.mkdirSync(OUT, { recursive: true })
const URL = "http://localhost:4174?name=Test%20Invitado"

async function open(page) {
  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForSelector("#loader.is-done", { state: "attached", timeout: 60000 })
  await page.mouse.wheel(0, 100)
  await page.waitForFunction(() => window.__exp?.phase === "open", { timeout: 30000 })
}

async function measure(page) {
  return page.evaluate(() => {
    const page3 = document.querySelectorAll(".cb-page")[2]
    const ul = document.querySelector("#notes-list")
    const pal = document.querySelector("#dress-palette")
    const R = (el) => {
      const b = el.getBoundingClientRect()
      return { t: Math.round(b.top), b: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }
    }
    return {
      page: R(page3),
      ul: { ...R(ul), columns: getComputedStyle(ul).columnCount },
      palette: { ...R(pal), hidden: pal.hidden, dots: pal.querySelectorAll(".cb-palette__dot").length },
      dotColors: [...pal.querySelectorAll(".cb-palette__dot")].map(
        (d) => getComputedStyle(d).backgroundColor,
      ),
      paletteOverflowBottom: Math.round(pal.getBoundingClientRect().bottom - page3.getBoundingClientRect().bottom),
      notesOverflowBottom: Math.round(ul.getBoundingClientRect().bottom - page3.getBoundingClientRect().bottom),
    }
  })
}

async function run(name, viewport, touch) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch,
    reducedMotion: "reduce",
  })
  const page = await context.newPage()
  await open(page)
  await page.evaluate((p) => window.__exp?.snap?.goToPage(p), 3)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(name, JSON.stringify(await measure(page)))
  await browser.close()
}

await run("mobile-390", { width: 390, height: 844 }, true)
await run("narrow-320", { width: 320, height: 568 }, true)
await run("desktop-1440", { width: 1440, height: 900 }, false)
process.exit(0)
