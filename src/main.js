import "./style.css"
import { getGuest } from "./guest.js"
import { wedding } from "./config.js"
import { Experience } from "./three/Experience.js"
import { showHint, hideHint } from "./ui/overlay.js"

// El recorrido siempre empieza arriba (y bloqueado hasta abrir el sobre)
history.scrollRestoration = "manual"
window.scrollTo(0, 0)
const root = document.documentElement
root.classList.add("is-locked")

// 1. ¿Quién abre la invitación?
const guest = getGuest()

// El nombre viaja hasta el título de la pestaña (y previews de chat)
document.title = guest.isFallback
  ? `${wedding.groom} & ${wedding.bride} · Nuestra boda`
  : `Para ${guest.name} · ${wedding.groom} & ${wedding.bride}`

let experience

boot()

async function boot() {
  // 2. Las fuentes deben estar listas ANTES de pintar las texturas del
  //    sobre (el nombre del invitado se dibuja con la fuente caligráfica).
  await Promise.all([document.fonts.ready, nextFrames(1)])

  const canvas = document.getElementById("scene")
  experience = window.__exp = new Experience(canvas, guest, {
    onOpenStart: () => hideHint(),
    onOpened: () => {
      root.classList.remove("is-locked")
      root.classList.add("is-open")
    },
  })

  await experience.ready

  // 3. UI de cada sección (cada módulo inyecta su HTML en su #stage-N)
  const [{ initCardUi }, { initRingsUi }, { initBouquetUi }] = await Promise.all([
    import("./ui/card/cardUi.js"),
    import("./ui/rings/ringsUi.js"),
    import("./ui/bouquet/bouquetUi.js"),
  ])
  const { card, rings, bouquet } = experience.sections
  initCardUi({ section: card, guest, experience })
  initRingsUi({ section: rings, experience })
  initBouquetUi({ section: bouquet, guest, experience })

  // Botón siempre presente: sale de cualquier anillo y vuelve al inicio de la página
  document.getElementById("home-btn").addEventListener("click", () => {
    if (rings.insideIndex !== null) rings.exit(true)
    if (card.isPaperOpen) card.closePaper()
    window.scrollTo({ top: 0, behavior: "auto" })
  })

  await nextFrames(2)
  document.getElementById("loader").classList.add("is-done")
  showHint(guest)
}

function nextFrames(n) {
  return new Promise((resolve) => {
    const step = () => (n-- <= 0 ? resolve() : requestAnimationFrame(step))
    requestAnimationFrame(step)
  })
}

// Limpieza al salir (SPA-friendly)
window.addEventListener("pagehide", () => experience?.dispose())
