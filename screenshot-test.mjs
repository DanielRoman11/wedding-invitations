import { chromium } from "playwright-core"

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
})
const page = await context.newPage()

await page.goto("http://localhost:5174/?name=Familia+Mora", {
  waitUntil: "networkidle",
})

// Esperar a que el loader termine
await page.waitForSelector("#loader.is-done", { timeout: 15000 })
await page.waitForFunction(() => window.__exp?.phase === "sealed", { timeout: 10000 })
await page.waitForTimeout(500)

// Abrir sobre con teclado (ArrowDown)
await page.keyboard.press("ArrowDown")
await page.waitForSelector("html.is-open", { timeout: 15000 })
await page.waitForTimeout(2000)

// Scroll a página 3 (sec-2, solo flores, panel oculto)
await page.evaluate(() => {
  const sec2 = document.getElementById("sec-2")
  if (sec2) window.scrollTo({ top: sec2.offsetTop, behavior: "instant" })
})
await page.waitForTimeout(2500)
await page.screenshot({ path: "/mnt/HDD/code/weddingInvitations/tmp/bouquet-flowers-only.png" })

// Scroll a página 4 (sec-2b, formulario visible)
await page.evaluate(() => {
  const sec2b = document.getElementById("sec-2b")
  if (sec2b) window.scrollTo({ top: sec2b.offsetTop, behavior: "instant" })
})
await page.waitForTimeout(2500)
await page.screenshot({ path: "/mnt/HDD/code/weddingInvitations/tmp/bouquet-form-visible.png" })

// Volver a página 3 (panel debe ocultarse)
await page.evaluate(() => {
  const sec2 = document.getElementById("sec-2")
  if (sec2) window.scrollTo({ top: sec2.offsetTop, behavior: "instant" })
})
await page.waitForTimeout(2500)
await page.screenshot({ path: "/mnt/HDD/code/weddingInvitations/tmp/bouquet-back-to-flowers.png" })

await browser.close()
console.log("Screenshots guardadas en tmp/")
