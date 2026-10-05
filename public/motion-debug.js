const out = document.getElementById("out")
const lines = []
const add = (k, v, bad) => lines.push(`${k}: ${bad ? "BAD >> " : ""}${v}`)

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
add("prefers-reduced-motion: reduce", reduced, reduced)
add("prefers-reduced-motion: no-preference", matchMedia("(prefers-reduced-motion: no-preference)").matches)
add("userAgent", navigator.userAgent)
add("hardwareConcurrency", navigator.hardwareConcurrency)
add("deviceMemory", navigator.deviceMemory)
add("touch points", navigator.maxTouchPoints)

// ¿Corre requestAnimationFrame?
let rafCount = 0
const t0 = performance.now()
const loop = () => {
  rafCount++
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

out.textContent = lines.join("\n") + "\n\n(midiendo RAF 3s…)"

setTimeout(() => {
  const secs = (performance.now() - t0) / 1000
  const fps = Math.round(rafCount / secs)
  add("RAF fps (3s)", fps, fps < 20)
  out.innerHTML = lines
    .map((l) => (l.includes("BAD >>") ? `<span class="bad">${l}</span>` : l))
    .join("\n")
}, 3000)
