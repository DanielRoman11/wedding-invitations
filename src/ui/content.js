import { wedding, practicalNotes, dressPalette, gifts, calendar } from "../config.js"

const $ = (id) => document.getElementById(id)

/** Crea un elemento con texto seguro (nunca innerHTML con datos de config) */
function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/* ---------------------------- calendario ---------------------------- */

function eventTimes() {
  const start = new Date(`${wedding.dateISO}${calendar.utcOffset}`)
  const end = new Date(start.getTime() + calendar.durationHours * 3_600_000)
  return { start, end }
}

// 2026-11-15T21:00:00.000Z → 20261115T210000Z
const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

const eventTitle = () => `Boda de ${wedding.bride} y ${wedding.groom}`
const eventPlace = () => `${wedding.venueName}, ${wedding.venueAddress}`

function googleCalendarUrl() {
  const { start, end } = eventTimes()
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle(),
    dates: `${stamp(start)}/${stamp(end)}`,
    location: eventPlace(),
    details: `Vestimenta: ${wedding.dressCode}. Mapa: ${wedding.mapsUrl}`,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

const icsEscape = (t) => t.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n")

function downloadIcs() {
  const { start, end } = eventTimes()
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Invitacion de boda//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:boda-${stamp(start)}@invitacion`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${icsEscape(eventTitle())}`,
    `LOCATION:${icsEscape(eventPlace())}`,
    `DESCRIPTION:${icsEscape(`Vestimenta: ${wedding.dressCode}\n${wedding.mapsUrl}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Mañana es la boda",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement("a"), { href: url, download: "boda.ics" })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/* ------------------------------ copiar ------------------------------ */

async function copyText(text, labelNode) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = Object.assign(document.createElement("textarea"), { value: text })
    document.body.append(area)
    area.select()
    document.execCommand("copy")
    area.remove()
  }
  const original = labelNode.textContent
  labelNode.textContent = "Copiado"
  setTimeout(() => (labelNode.textContent = original), 1600)
}

function copyIcon() {
  const wrap = document.createElement("span")
  wrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
  return wrap.firstElementChild
}

/* ------------------------------ render ------------------------------ */

/** Rellena el reverso de la carta: lugar, calendario, notas y lluvia de sobres */
export function fillCardBack() {
  // Lugar
  $("venue-name").textContent = wedding.venueName
  $("venue-address").textContent = wedding.venueAddress
  $("maps-btn").href = wedding.mapsUrl

  // Calendario
  $("date-label").textContent = `${wedding.dateLabel} · ${wedding.timeLabel}`
  $("gcal-btn").href = googleCalendarUrl()
  $("ics-btn").addEventListener("click", downloadIcs)

  // Notas prácticas
  const notes = $("notes-list")
  practicalNotes.forEach((text) => notes.append(el("li", "", text)))
  $("notes-block").hidden = practicalNotes.length === 0

  // Paleta de vestimenta (tarjeta flotante)
  $("palette-title").textContent = dressPalette.title
  const paletteGroups = $("palette-groups")
  dressPalette.groups.forEach((group) => {
    const row = el("div", "cb-palette__group")
    row.append(el("span", "cb-palette__label", group.label))
    const swatches = el("ul", "cb-palette__swatches")
    group.colors.forEach((color) => {
      const swatch = el("li", "cb-palette__swatch")
      swatch.style.setProperty("--swatch", color.hex)
      swatch.title = color.name
      swatch.setAttribute("aria-label", color.name)
      swatch.append(el("i", "cb-palette__dot"))
      swatches.append(swatch)
    })
    row.append(swatches)
    paletteGroups.append(row)
  })
  $("dress-palette").hidden = dressPalette.groups.length === 0

  $("gifts-title").textContent = gifts.title
  $("gifts-message").textContent = gifts.message
  const accounts = $("gifts-accounts")
  gifts.accounts.forEach((acc) => {
    const li = el("li", "accounts__row")
    if (acc.qr) {
      const link = el("a", "accounts__qr-link")
      link.href = acc.qr
      link.target = "_blank"
      link.rel = "noopener"
      link.title = "Ampliar QR"
      const img = el("img", "accounts__qr")
      img.src = acc.qr
      img.alt = acc.label ? `QR ${acc.label}` : "QR"
      link.append(img)
      li.append(link)
    }
    const info = el("div", "accounts__info")
    if (acc.label) info.append(el("strong", "", acc.label))
    const label = el("span", "", acc.text)
    const copy = el("button", "accounts__copy")
    copy.type = "button"
    copy.title = "Copiar"
    copy.append(copyIcon(), label)
    copy.addEventListener("click", () => copyText(acc.text, label))
    info.append(copy)
    li.append(info)
    accounts.append(li)
  })
  accounts.hidden = gifts.accounts.length === 0
}
