import { appendRow, readRange } from "../_lib/sheets.js"
import { json, sameOrigin, readJson, clean, bogotaNow, rateLimited } from "../_lib/http.js"

const MAX_WISHES = 80

/**
 * GET /api/wishes  → deseos visibles (los más recientes) para los faroles.
 * Para ocultar uno, escribe NO en la columna "Visible" de la hoja.
 */
export async function onRequestGet({ env }) {
  try {
    const rows = await readRange(env, "Deseos!A2:D1000")
    const wishes = rows
      .filter((r) => r[1] && r[2] && String(r[3] ?? "SI").trim().toUpperCase() !== "NO")
      .slice(-MAX_WISHES)
      .map((r) => ({ name: r[1], message: r[2] }))
    return json({ wishes }, 200, { "cache-control": "public, max-age=30" })
  } catch (err) {
    console.error(err)
    return json({ wishes: [] }, 200)
  }
}

/** POST /api/wishes → guarda un deseo nuevo */
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403)
  if (rateLimited(request, 4)) return json({ error: "Demasiados intentos, espera un momento." }, 429)

  let body
  try {
    body = await readJson(request)
  } catch {
    return json({ error: "Solicitud inválida." }, 400)
  }
  if (body.website) return json({ ok: true })

  const name = clean(body.name, 40)
  const message = clean(body.message, 140)
  if (!name) return json({ error: "Escribe tu nombre." }, 400)
  if (message.length < 3) return json({ error: "Escribe un deseo un poco más largo." }, 400)

  try {
    await appendRow(env, "Deseos", [bogotaNow(), name, message, "SI"])
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: "No pudimos enviar tu deseo. Inténtalo de nuevo." }, 502)
  }
}
