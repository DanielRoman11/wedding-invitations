import html from "./arch.html?raw"
import "./arch.css"

/**
 * UI de la última escena (arco de deseos): solo un botón para salir del
 * zoom de un mensaje, pensado para móvil (en escritorio basta Escape o
 * tocar fuera de la tarjeta).
 * @param {{section: import("../../three/sections/ArchSection.js").ArchSection}} deps
 */
export function initArchUi({ section }) {
  const host = document.getElementById("stage-3")
  if (!host) return
  host.innerHTML = html
  const back = host.querySelector("#arch-back")
  back.addEventListener("click", () => section.exitZoom())

  section.on("zoom", (card) => {
    if (card) {
      back.hidden = false
      requestAnimationFrame(() => requestAnimationFrame(() => back.classList.add("is-on")))
    } else {
      back.classList.remove("is-on")
      setTimeout(() => {
        if (!back.classList.contains("is-on")) back.hidden = true
      }, 340)
    }
  })
}
