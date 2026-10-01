import { wedding } from "../config.js"
import { sendRsvp, sendWish } from "../api.js"

const $ = (id) => document.getElementById(id)
const STORAGE_KEY = "wedding-rsvp-v1"

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Modo privado o almacenamiento bloqueado: la respuesta ya está en la hoja
  }
}

function showError(form, message) {
  const box = form.querySelector(".form__error")
  box.textContent = message
  box.hidden = !message
}

/** Bloquea el botón mientras se envía y vuelve a habilitarlo al terminar */
async function submitting(form, task) {
  const button = form.querySelector('[type="submit"]')
  const label = button.textContent
  button.disabled = true
  button.textContent = "Enviando…"
  showError(form, "")
  try {
    await task()
  } catch (err) {
    showError(form, err.message)
  } finally {
    button.disabled = false
    button.textContent = label
  }
}

const firstName = (full) => full.trim().split(/\s+/)[0]

/* --------------------------------- RSVP --------------------------------- */

/**
 * @param {{name:string,isFallback:boolean}} guest
 * @param {(result:{attending:boolean,name:string}) => void} onDone
 */
export function initRsvpForm(guest, onDone) {
  const form = $("rsvp-form")
  const done = $("rsvp-done")

  const conditional = [...form.querySelectorAll('[data-when="si"]')]
  const setAttending = (value) => {
    conditional.forEach((node) => (node.hidden = value !== "si"))
  }

  if (!guest.isFallback) form.elements.name.value = guest.name

  form.addEventListener("change", (e) => {
    if (e.target.name === "attending") setAttending(e.target.value)
  })

  const renderDone = ({ attending, name }) => {
    const first = firstName(name)
    $("rsvp-done-title").textContent = attending
      ? `¡Gracias, ${first}!`
      : `Gracias por avisarnos, ${first}`
    $("rsvp-done-text").textContent = attending
      ? `Quedó registrada tu asistencia. Nos vemos el ${wedding.dateLabel}.`
      : "Lamentamos que no puedas acompañarnos. Te llevamos en el corazón."

    const intro = attending
      ? `¡Hola! Soy ${name} y confirmo mi asistencia a la boda de ${wedding.groom} & ${wedding.bride}`
      : `¡Hola! Soy ${name} y lamentablemente no podré asistir a la boda de ${wedding.groom} & ${wedding.bride}`
    $("rsvp-whatsapp").href = `https://wa.me/${wedding.whatsapp}?text=${encodeURIComponent(intro)}`

    form.hidden = true
    done.hidden = false
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault()
    const data = new FormData(form)
    const name = String(data.get("name") || "").trim()
    const attending = data.get("attending")

    if (!name) return showError(form, "Escribe tu nombre.")
    if (!attending) return showError(form, "Cuéntanos si nos acompañas.")

    submitting(form, async () => {
      await sendRsvp({
        name,
        attending,
        allergies: data.get("allergies") || "",
        comment: data.get("comment") || "",
        website: data.get("website") || "",
        guest: guest.isFallback ? "" : guest.name,
      })
      const result = { attending: attending === "si", name }
      save(result)
      renderDone(result)
      onDone(result)
    })
  })

  $("rsvp-edit").addEventListener("click", () => {
    done.hidden = true
    form.hidden = false
  })

  // Si ya respondió antes en este dispositivo, se lo recordamos
  const saved = readSaved()
  if (saved?.name) {
    form.elements.name.value = saved.name
    const radio = form.querySelector(`[name="attending"][value="${saved.attending ? "si" : "no"}"]`)
    if (radio) {
      radio.checked = true
      setAttending(radio.value)
    }
    renderDone(saved)
  }
}

/* --------------------------------- Deseos -------------------------------- */

/** @param {(wish:{name:string,message:string}) => void} onDone */
export function initWishForm(guest, onDone) {
  const form = $("wish-form")
  const counter = $("wish-count")

  // El campo de nombre solo existe (visible) cuando no sabemos quién es el invitado
  const nameInput = form.elements.name
  const askName = Boolean(guest.isFallback)

  const updateCount = () => {
    counter.textContent = `${form.elements.message.value.length} / 140`
  }
  form.elements.message.addEventListener("input", updateCount)
  updateCount()

  form.addEventListener("submit", (e) => {
    e.preventDefault()
    const name = (askName ? nameInput.value : guest.name).trim()
    const message = form.elements.message.value.trim()
    if (!name) return showError(form, "Escribe tu nombre.")
    if (message.length < 3) return showError(form, "Escribe un deseo un poco más largo.")

    submitting(form, async () => {
      await sendWish({ name, message, website: form.elements.website.value })
      form.elements.message.value = ""
      updateCount()
      onDone({ name, message })
    })
  })
}
