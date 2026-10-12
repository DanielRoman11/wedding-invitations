import html from "./arch.html?raw"
import "./arch.css"
import { initWishForm } from "../forms.js"

/** @param {{section: import("../../three/sections/ArchSection.js").ArchSection, guest: {name:string,isFallback:boolean}, experience: {onStageChange:(callback:(stage:number)=>void)=>void}}} deps */
export function initArchUi({ section, guest, experience }) {
  const host = document.getElementById("stage-3")
  if (!host) return
  host.innerHTML = html
  const add = host.querySelector("#arch-add")
  const back = host.querySelector("#arch-back")
  const dialog = host.querySelector("#arch-composer")
  const form = host.querySelector("#arch-wish-form")
  const toast = host.querySelector("#arch-toast")
  const root = document.documentElement
  let hadModalLock = false
  let zoomed = false
  let zoomTimer = 0
  let toastTimer = 0
  let toastHideTimer = 0

  back.addEventListener("click", () => section.exitZoom())
  host.querySelector("#arch-composer-close").addEventListener("click", () => dialog.close())
  add.addEventListener("click", () => {
    if (dialog.open) return
    hadModalLock = root.classList.contains("is-modal")
    dialog.showModal()
    root.classList.add("is-modal")
    add.setAttribute("aria-expanded", "true")
    const nameField = form.querySelector("[data-wish-name-field]")
    const firstField = nameField.hidden ? form.elements.message : form.elements.name
    requestAnimationFrame(() => firstField.focus({ preventScroll: true }))
  })

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close()
  })
  dialog.addEventListener("close", () => {
    add.setAttribute("aria-expanded", "false")
    if (!hadModalLock) root.classList.remove("is-modal")
    hadModalLock = false
    if (host.classList.contains("is-active") && !add.hidden) add.focus({ preventScroll: true })
  })

  initWishForm(guest, (wish) => {
    section.addWish(wish)
    if (dialog.open) dialog.close()
    showToast()
  }, form)

  experience.onStageChange((stage) => {
    if (stage !== 3 && dialog.open) dialog.close()
  })

  section.on("zoom", (card) => {
    window.clearTimeout(zoomTimer)
    if (card) {
      zoomed = true
      add.hidden = true
      back.hidden = false
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (zoomed) back.classList.add("is-on")
        }),
      )
    } else {
      zoomed = false
      back.classList.remove("is-on")
      zoomTimer = window.setTimeout(() => {
        if (zoomed) return
        back.hidden = true
        add.hidden = false
      }, 340)
    }
  })

  function showToast() {
    window.clearTimeout(toastTimer)
    window.clearTimeout(toastHideTimer)
    toast.hidden = false
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("is-on")))
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-on")
      toastHideTimer = window.setTimeout(() => {
        if (!toast.classList.contains("is-on")) toast.hidden = true
      }, 320)
    }, 4000)
  }
}
