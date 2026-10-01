import { appendRow } from "../_lib/sheets.js"
import { json, sameOrigin, readJson, clean, bogotaNow, rateLimited } from "../_lib/http.js"

/** POST /api/rsvp  → agrega una fila en la pestaña "RSVP" */
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403)
  if (rateLimited(request)) return json({ error: "Demasiados intentos, espera un momento." }, 429)

  let body
  try {
    body = await readJson(request)
  } catch {
    return json({ error: "Solicitud inválida." }, 400)
  }

  // Campo trampa para bots: un humano nunca lo llena
  if (body.website) return json({ ok: true })

  const name = clean(body.name, 80)
  const attending = body.attending === "si" ? "Sí" : body.attending === "no" ? "No" : ""
  const people = Math.round(Number(body.people))

  if (!name) return json({ error: "Escribe tu nombre." }, 400)
  if (!attending) return json({ error: "Cuéntanos si nos acompañas." }, 400)
  if (attending === "Sí" && !(people >= 1 && people <= 10)) {
    return json({ error: "Indica cuántas personas asistirán." }, 400)
  }

  try {
    await appendRow(env, "RSVP", [
      bogotaNow(),
      name,
      attending,
      attending === "Sí" ? people : 0,
      clean(body.allergies, 300),
      clean(body.comment, 300),
      clean(body.guest, 80),
    ])
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: "No pudimos guardar tu respuesta. Inténtalo de nuevo." }, 502)
  }
}
