import { wedding } from "../../config.js"
import { initRsvpForm } from "../forms.js"
import html from "./bouquet.html?raw"
import "./bouquet.css"

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Página donde se muestra el formulario (sec-2b es la 5.ª ancla, índice 4)
const PANEL_PAGE = 4

/**
 * UI de la sección 2 (ramo): cuenta regresiva, vestimenta y RSVP.
 * @param {{section: import("../../three/sections/BouquetSection.js").BouquetSection,
 *          guest: {name:string,isFallback:boolean}, experience: object}} deps
 */
export function initBouquetUi({ section, guest, experience }) {
  const host = document.getElementById("stage-2")
  host.innerHTML = html
  const $ = (id) => host.querySelector(`#${id}`)

  const prevBtn = $("bq-prev")
  const nextBtn = $("bq-next")
  const stepsEl = host.querySelector(".bq-steps")
  const panel = host.querySelector(".bq-panel")
  const bodyScroll = host.querySelector(".bq-panel__body-scroll")

  $("bq-names").textContent = `${wedding.bride} & ${wedding.groom}`
  $("bq-date").textContent = wedding.dateLabel
  if (wedding.invitationMessage) {
    const msg = $("bq-message")
    msg.textContent = wedding.invitationMessage
    msg.hidden = false
  }

  /* ------------------------- cuenta regresiva ------------------------- */
  const lead = $("bq-count-lead")
  const fine = $("bq-count-fine")
  const target = new Date(wedding.dateISO).getTime()
  const pad = (n) => String(n).padStart(2, "0")

  const tick = () => {
    const diff = target - Date.now()
    if (diff <= 0) {
      lead.textContent = "¡Es hoy, es hoy!"
      fine.textContent = ""
      return
    }
    const s = Math.floor(diff / 1000)
    const days = Math.floor(s / 86400)
    lead.textContent = days === 1 ? "Falta 1 día" : `Faltan ${days} días`
    fine.textContent =
      `${plural(Math.floor((s % 86400) / 3600), "hora", "horas")} · ` +
      `${pad(Math.floor((s % 3600) / 60))} min · ${pad(s % 60)} s`
  }
  tick()
  // Solo corre mientras la sección del ramo es la activa
  setInterval(() => {
    if (experience.stage === 2) tick()
  }, 1000)

  /* ---------------------- visibilidad del panel ---------------------- */
  // El panel se muestra cuando el scroll llega a sec-2b (página 4).
  // En landscape siempre es visible cuando la sección está activa.
  const isLandscape = () => window.innerWidth / window.innerHeight >= 0.85
  let panelVisible = false

  const showPanel = () => {
    if (panelVisible) return
    panelVisible = true
    panel.classList.add("is-visible")
    stepsEl.hidden = false
    requestAnimationFrame(() => stepsEl.classList.add("is-on"))
  }

  const hidePanel = () => {
    if (!panelVisible) return
    panelVisible = false
    panel.classList.remove("is-visible")
    stepsEl.classList.remove("is-on")
    // Ocultar steps al terminar la transición
    const onEnd = (e) => {
      if (e.target !== panel) return
      if (!panelVisible) stepsEl.hidden = true
      panel.removeEventListener("transitionend", onEnd)
    }
    panel.addEventListener("transitionend", onEnd)
  }

  const updatePanelVisibility = () => {
    if (isLandscape()) {
      showPanel()
      return
    }
    const page = experience.snapCurrentPage()
    if (page >= PANEL_PAGE) showPanel()
    else hidePanel()
  }

  window.addEventListener("resize", updatePanelVisibility)

  let wasActive = false
  const watch = () => {
    const active = experience.stage === 2
    if (active && !wasActive) {
      updatePanelVisibility()
      bodyScroll.scrollTop = 0
    }
    if (active) updatePanelVisibility()
    if (!active && wasActive) {
      // Al salir del ramo, ocultar el panel
      hidePanel()
    }
    wasActive = active
  }
  setInterval(watch, 300)

  /* ---------------------------- step toolbar ---------------------------- */
  prevBtn.addEventListener("click", () => experience.goToSection(1))
  nextBtn.addEventListener("click", () => experience.goToSection(3))

  /* ------------------------------- RSVP ------------------------------- */
  initRsvpForm(guest, () => {
    experience.celebrate()
    // Asegurar que el panel esté visible al mostrar la confirmación
    showPanel()
    $("rsvp-done").scrollIntoView({ block: "nearest", behavior: "smooth" })
  })
}
