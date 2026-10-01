/** Utilidades compartidas por los endpoints */

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  })

/** Solo aceptamos peticiones hechas desde el propio sitio */
export function sameOrigin(request) {
  const origin = request.headers.get("origin")
  if (!origin) return true
  return new URL(origin).host === new URL(request.url).host
}

/** Lee el JSON del cuerpo con un tope de tamaño */
export async function readJson(request, maxBytes = 4096) {
  const text = await request.text()
  if (text.length > maxBytes) throw new Error("Cuerpo demasiado grande")
  return JSON.parse(text)
}

export const clean = (value, max) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, max)

export const bogotaNow = () =>
  new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })

/**
 * Límite simple por IP en memoria (por instancia del Worker).
 * No es infalible, pero frena el spam casual.
 */
const hits = new Map()
export function rateLimited(request, limit = 6, windowMs = 60_000) {
  const ip = request.headers.get("cf-connecting-ip") || "local"
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > limit
}
