import { wedding } from "../../config.js"
import { initRsvpForm } from "../forms.js"
import html from "./bouquet.html?raw"
import "./bouquet.css"

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * UI de la sección 2 (ramo): cuenta regresiva, vestimenta y RSVP.
 * @param {{section: import("../../three/sections/BouquetSection.js").BouquetSection,
 *          guest: {name:string,isFallback:boolean}, experience: object}} deps
 */
export function initBouquetUi({ section, guest, experience }) {
  const host = document.getElementById("stage-2")
  host.innerHTML = html
  const $ = (id) => host.querySelector(`#${id}`)

  $("bq-dress").textContent = wedding.dressCode
  $("bq-names").textContent = `${wedding.groom} & ${wedding.bride}`
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

  /* ------------------------------ pista ------------------------------- */
  const hint = $("bq-hint")
  let hintTimer = 0
  let hintDone = false
  const hideHint = () => {
    if (hintDone) return
    hintDone = true
    clearTimeout(hintTimer)
    hint.classList.remove("is-on")
    hint.classList.add("is-off")
    window.removeEventListener("pointermove", onDrag)
  }
  let down = false
  const onDown = (e) => {
    if (experience.stage !== 2 || e.target.closest(".bq-panel")) return
    down = true
  }
  const onDrag = () => {
    if (down) hideHint()
  }
  window.addEventListener("pointerdown", onDown)
  window.addEventListener("pointermove", onDrag)
  window.addEventListener("pointerup", () => (down = false))

  let wasActive = false
  const watch = () => {
    const active = experience.stage === 2
    if (active && !wasActive && !hintDone) {
      hint.classList.add("is-on")
      clearTimeout(hintTimer)
      hintTimer = setTimeout(hideHint, 4600)
    }
    wasActive = active
  }
  setInterval(watch, 300)

  /* ------------------------------- RSVP ------------------------------- */
  initRsvpForm(guest, () => {
    experience.celebrate()
    // La confirmación ya se muestra dentro del panel; la llevamos a la vista
    $("rsvp-done").scrollIntoView({ block: "nearest", behavior: "smooth" })
  })
}
