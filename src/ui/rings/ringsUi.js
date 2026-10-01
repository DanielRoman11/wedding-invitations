import html from "./rings.html?raw"
import "./rings.css"
import * as config from "../../config.js"

const DRAG_HINT_MS = 4000

/**
 * UI HTML de la sección de anillos: etiquetas sobre cada anillo, notas,
 * y HUD interior (volver, título, flechas, puntos, pista, texto para lectores).
 * @param {{ section: import("../../three/sections/RingsSection.js").RingsSection, experience: object }} deps
 */
export function initRingsUi({ section }) {
  const stage = document.getElementById("stage-1")
  if (!stage) return
  stage.insertAdjacentHTML("beforeend", html)

  const labels = [...stage.querySelectorAll(".ring-label")]
  const hud = stage.querySelector("#ring-hud")
  const title = stage.querySelector(".ring-title")
  const dots = stage.querySelector(".ring-dots")
  const drag = stage.querySelector(".ring-drag")
  const live = stage.querySelector(".ring-live")

  const texts = Array.isArray(config.ringLabels)
    ? config.ringLabels
    : [config.ringLabels?.story, config.ringLabels?.promise]
  const fallbackTexts = ["Nuestra historia", "Nuestra promesa"]
  labels.forEach((el, i) => {
    const text = (typeof texts[i] === "string" ? texts[i] : texts[i]?.label) || fallbackTexts[i]
    el.querySelector(".ring-label__text").textContent = text
    el.setAttribute("aria-label", `Entrar: ${text}`)
    el.addEventListener("click", () => section.enter(i))
  })

  stage.querySelector(".ring-back").addEventListener("click", () => section.exit())
  stage.querySelector(".ring-step--prev").addEventListener("click", () => section.step(-1))
  stage.querySelector(".ring-step--next").addEventListener("click", () => section.step(1))

  let dragTimer = 0
  const hideDrag = () => {
    clearTimeout(dragTimer)
    drag.classList.add("is-gone")
    window.removeEventListener("pointerdown", onFirstPointer, true)
  }
  const onFirstPointer = (e) => {
    if (e.target instanceof Element && e.target.closest("#ring-hud button")) return
    hideDrag()
  }

  section.on("labels", (list) => {
    labels.forEach((el, i) => {
      const l = list[i]
      if (!l) return
      el.classList.toggle("is-visible", Boolean(l.visible))
      el.tabIndex = l.visible ? 0 : -1
      if (l.visible) el.style.transform = `translate(${l.x}px, ${l.y}px) translate(-50%, -50%)`
    })
  })

  section.on("enter", () => {
    stage.classList.add("is-inside")
    hud.setAttribute("aria-hidden", "false")
    drag.classList.remove("is-gone")
    clearTimeout(dragTimer)
    dragTimer = setTimeout(hideDrag, DRAG_HINT_MS)
    window.addEventListener("pointerdown", onFirstPointer, true)
  })

  section.on("exit", () => {
    stage.classList.remove("is-inside")
    hud.setAttribute("aria-hidden", "true")
    live.textContent = ""
    hideDrag()
  })

  section.on("panel", ({ index, count, title: t, text }) => {
    title.textContent = t || ""
    live.textContent = [t, text].filter(Boolean).join(". ")
    if (dots.children.length !== count) {
      dots.replaceChildren(
        ...Array.from({ length: count }, () => {
          const d = document.createElement("span")
          d.className = "ring-dot"
          return d
        }),
      )
    }
    ;[...dots.children].forEach((d, i) => d.classList.toggle("is-active", i === index))
  })
}
