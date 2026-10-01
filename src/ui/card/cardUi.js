import html from "./card.html?raw"
import "./card.css"
import { fillCardBack } from "../content.js"
import { initWishForm } from "../forms.js"
import { CARD_H, SHEET_LIFT } from "../../three/world.js"

const HIDE_WISH_MS = 7000
const TOAST_MS = 4200

/**
 * UI HTML de la sección 0 (la carta).
 * @param {{section: import("../../three/sections/CardSection.js").CardSection,
 *   guest: {name:string,isFallback:boolean}, experience: {goToSection:(i:number)=>void}}} deps
 */
export function initCardUi({ section, guest, experience }) {
  const stage = document.getElementById("stage-0")
  stage.insertAdjacentHTML("beforeend", html)

  const $ = (id) => document.getElementById(id)
  const dock = stage.querySelector(".card-dock")
  const back = $("card-back")
  const wish = $("wish-panel")
  const cueNext = $("card-cue-next")
  const toast = $("card-toast")
  const wishRead = $("wish-read")

  fillCardBack()
  const pager = initBackPages(back, section, experience)

  /* ------------------------------ rect ------------------------------ */
  const place = (rect) => {
    if (!rect || !rect.width) return
    for (const node of [back, wish]) {
      const s = node.style
      s.left = `${rect.left}px`
      s.top = `${rect.top}px`
      s.width = `${rect.width}px`
      s.height = `${rect.height}px`
      s.setProperty("--cw", `${rect.width}px`)
    }
  }
  const refresh = () => place(section.overlayRect)
  refresh()
  section.on("layout", place)
  window.addEventListener("resize", refresh)

  /* ----------------------------- visibilidad ----------------------------- */
  // Mostrar: se quita hidden y, en el siguiente frame, .is-in (fade). Ocultar: al instante.
  const show = (node) => {
    node.hidden = false
    refresh()
    requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add("is-in")))
  }
  const hide = (node) => {
    node.classList.remove("is-in")
    node.hidden = true
  }

  // El scroll voltea la carta: la pista dice qué pasa al deslizar
  const syncDock = () => {
    dock.classList.toggle("is-paper", section.isPaperOpen)
    dock.classList.toggle("is-flipped", section.isFlipped)
    cueNext.textContent = !section.isFlipped
      ? "Para voltear la carta"
      : pager.current() < pager.count - 1
        ? "Siguiente hoja"
        : "Los anillos"
  }

  section.on("flip", (flipped) => {
    if (flipped) {
      show(back)
    } else {
      hide(back)
    }
    syncDock()
  })

  // El papel de deseos queda al frente: el reverso (texto del lugar y demás) se
  // esconde y vuelve cuando se cierra el papel, si la carta sigue girada.
  section.on("sheetpos", syncDock)

  section.on("paper", (open) => {
    if (open) {
      hide(back)
      show(wish)
    } else {
      hide(wish)
      if (section.isFlipped) show(back)
    }
    syncDock()
  })

  $("rsvp-btn").addEventListener("click", () => experience.goToSection(2))
  $("wish-close").addEventListener("click", () => section.closePaper())

  /* ------------------------------- deseos ------------------------------- */
  // El campo de nombre solo se muestra si no conocemos al invitado
  $("wish-name-field").hidden = !guest.isFallback

  let toastTimer = 0
  const showToast = () => {
    toast.hidden = false
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("is-in")))
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-in")
      setTimeout(() => (toast.hidden = true), 400)
    }, TOAST_MS)
  }

  initWishForm(guest, (sent) => {
    section.releasePaper()
    section.launchWish(sent)
    hide(wish)
    showToast()
  })

  let readTimer = 0
  const closeRead = () => {
    clearTimeout(readTimer)
    wishRead.classList.remove("is-in")
    setTimeout(() => {
      if (!wishRead.classList.contains("is-in")) wishRead.hidden = true
    }, 300)
  }
  wishRead.querySelector(".wish-read__close").addEventListener("click", closeRead)

  section.on("lantern", (lantern) => {
    wishRead.querySelector(".wish-read__text").textContent = lantern.message
    wishRead.querySelector(".wish-read__who").textContent = lantern.name ? `de ${lantern.name}` : ""
    wishRead.hidden = false
    requestAnimationFrame(() => requestAnimationFrame(() => wishRead.classList.add("is-in")))
    clearTimeout(readTimer)
    readTimer = setTimeout(closeRead, HIDE_WISH_MS)
  })

  syncDock()
}

/**
 * El reverso es una pila de hojas (la primera es la carta misma, el resto está
 * detrás en 3D) y el SCROLL de la página las va quitando de arriba una a una,
 * cada una en su propia página de scroll con imán. No hay botones ni scroll interno. Las fotos flotan en la escena 3D (CardSection).
 */
function initBackPages(back, section, experience) {
  const pages = [...back.querySelectorAll(".cb-page")].filter((p) => !p.hidden)
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const count = pages.length
  let current = 0

  // Una página de scroll por hoja: la primera ya existe (#sec-0b)
  const anchor = document.getElementById("sec-0b")
  for (let i = 1; i < count; i++) {
    const spacer = document.createElement("section")
    spacer.className = "sec"
    spacer.dataset.stage = "0"
    spacer.setAttribute("aria-hidden", "true")
    anchor.after(spacer)
  }
  requestAnimationFrame(() => experience.refreshJourney())

  // Hojas apiladas: la de arriba sube con el scroll (y su texto con ella) y deja
  // ver la siguiente, que ya estaba detrás. Sin deslizamiento lateral ni carrusel.
  const smooth = (x, a, b) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  function apply(pos) {
    const ppu = section.overlayRect.height / CARD_H
    pages.forEach((page, i) => {
      let opacity
      let lift = 0
      if (pos >= i) {
        // La hoja ya está arriba y se va: el texto sube con ella y se apaga
        const t = Math.min(1, pos - i)
        lift = t
        opacity = 1 - smooth(t, 0.15, 0.6)
      } else {
        // Todavía tapada por la de arriba: su texto aparece al quedar a la vista
        opacity = smooth(pos - (i - 1), 0.5, 1)
      }
      page.style.opacity = String(opacity)
      page.style.visibility = opacity > 0.01 ? "visible" : "hidden"
      page.style.pointerEvents = opacity > 0.7 ? "auto" : "none"
      page.style.transform = calm ? "none" : `translateY(${-lift * SHEET_LIFT * ppu * 0.9}px)`
      page.setAttribute("aria-hidden", String(opacity < 0.5))
    })
    current = Math.min(count - 1, Math.max(0, Math.round(pos)))
  }

  section.setSheetCount(count)
  section.on("sheetpos", apply)
  apply(section.sheetPos)

  return { count, current: () => current }
}
