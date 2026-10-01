import { wedding, practicalNotes, gifts, calendar } from "../config.js"

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

const eventTitle = () => `Boda de ${wedding.groom} y ${wedding.bride}`
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

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = Object.assign(document.createElement("textarea"), { value: text })
    document.body.append(area)
    area.select()
    document.execCommand("copy")
    area.remove()
  }
  const original = button.textContent
  button.textContent = "Copiado"
  setTimeout(() => (button.textContent = original), 1600)
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

  // Lluvia de sobres
  $("gifts-title").textContent = gifts.title
  $("gifts-message").textContent = gifts.message
  const accounts = $("gifts-accounts")
  gifts.accounts.forEach((acc) => {
    const li = el("li", "accounts__row")
    const info = el("span", "accounts__info")
    info.append(el("strong", "", acc.label))
    info.append(el("span", "", acc.value))
    if (acc.holder) info.append(el("small", "", acc.holder))
    const btn = el("button", "btn btn--ghost btn--small", "Copiar")
    btn.type = "button"
    btn.addEventListener("click", () => copyText(acc.value, btn))
    li.append(info, btn)
    accounts.append(li)
  })
  accounts.hidden = gifts.accounts.length === 0
}
