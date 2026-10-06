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

  const prevBtn = $("bq-prev")
  const nextBtn = $("bq-next")
  const stepsEl = host.querySelector(".bq-steps")
  const panel = host.querySelector(".bq-panel")
  const body = $("bq-body")
  const bodyScroll = host.querySelector(".bq-panel__body-scroll")
  const openBtn = $("bq-open")
  const handle = host.querySelector(".bq-panel__handle")

  $("bq-names").textContent = `${wedding.bride} & ${wedding.groom}`
  $("bq-date").textContent = wedding.dateLabel
  if (wedding.invitationMessage) {
    const msg = $("bq-message")
    const msg2 = $("bq-message-2")
    msg.textContent = wedding.invitationMessage
    msg.hidden = false
    if (msg2) {
      msg2.textContent = wedding.invitationMessage
      msg2.hidden = false
    }
  }

  /* ------------------------- cuenta regresiva ------------------------- */
  const leads = [$("bq-count-lead"), $("bq-count-lead-2")].filter(Boolean)
  const fines = [$("bq-count-fine"), $("bq-count-fine-2")].filter(Boolean)
  const target = new Date(wedding.dateISO).getTime()
  const pad = (n) => String(n).padStart(2, "0")

  const tick = () => {
    const diff = target - Date.now()
    if (diff <= 0) {
      leads.forEach((el) => (el.textContent = "¡Es hoy, es hoy!"))
      fines.forEach((el) => (el.textContent = ""))
      return
    }
    const s = Math.floor(diff / 1000)
    const days = Math.floor(s / 86400)
    const lead = days === 1 ? "Falta 1 día" : `Faltan ${days} días`
    const fine =
      `${plural(Math.floor((s % 86400) / 3600), "hora", "horas")} · ` +
      `${pad(Math.floor((s % 3600) / 60))} min · ${pad(s % 60)} s`
    leads.forEach((el) => (el.textContent = lead))
    fines.forEach((el) => (el.textContent = fine))
  }
  tick()
  // Solo corre mientras la sección del ramo es la activa
  setInterval(() => {
    if (experience.stage === 2) tick()
  }, 1000)

  /* ----------------------- panel plegable móvil ----------------------- */
  const isLandscape = () => window.innerWidth / window.innerHeight >= 0.85
  let isExpanded = false

  const syncSteps = () => {
    const show = isExpanded || isLandscape()
    stepsEl.hidden = !show
    if (show) requestAnimationFrame(() => stepsEl.classList.add("is-on"))
    else stepsEl.classList.remove("is-on")
  }

  const expandPanel = () => {
    if (isExpanded) return
    isExpanded = true
    panel.classList.add("is-expanded")
    body.hidden = false
    openBtn.setAttribute("aria-expanded", "true")
    syncSteps()
    // Al expandir, el contenido empieza arriba
    bodyScroll.scrollTop = 0
  }

  const collapsePanel = () => {
    if (!isExpanded) return
    isExpanded = false
    panel.classList.remove("is-expanded")
    openBtn.setAttribute("aria-expanded", "false")
    syncSteps()
    // Esperamos a que termine la transición para ocultar el body
    const onEnd = (e) => {
      if (e.target !== panel) return
      if (!isExpanded) body.hidden = true
      panel.removeEventListener("transitionend", onEnd)
    }
    panel.addEventListener("transitionend", onEnd)
  }

  openBtn.addEventListener("click", expandPanel)

  // Deslizar la manija para expandir/contraer
  let dragStartY = null
  const onPointerDown = (e) => {
    dragStartY = e.clientY
    handle.setPointerCapture(e.pointerId)
  }
  const onPointerUp = (e) => {
    if (dragStartY === null) return
    const dy = dragStartY - e.clientY
    const threshold = 40
    if (dy > threshold && !isExpanded) expandPanel()
    else if (dy < -threshold && isExpanded) collapsePanel()
    dragStartY = null
  }
  handle.addEventListener("pointerdown", onPointerDown)
  handle.addEventListener("pointerup", onPointerUp)

  window.addEventListener("resize", () => {
    if (isLandscape()) expandPanel()
    syncSteps()
  })

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
    if (active && !wasActive) {
      // Al entrar al ramo, el panel vuelve a su vista reducida en móvil
      if (!isLandscape()) collapsePanel()
      else expandPanel()
      bodyScroll.scrollTop = 0
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
    // La confirmación ya se muestra dentro del panel; lo expandimos en móvil
    expandPanel()
    $("rsvp-done").scrollIntoView({ block: "nearest", behavior: "smooth" })
  })
}
