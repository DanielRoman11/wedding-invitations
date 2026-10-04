/**
 * Cliente del backend (Cloudflare Pages Functions en /functions/api).
 * El sitio nunca ve credenciales de Google: solo habla con estos endpoints.
 */

async function post(path, body) {
  let res
  try {
    res = await fetch(`/api/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Sin conexión. Revisa tu internet e inténtalo de nuevo.")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "No se pudo enviar. Inténtalo de nuevo.")
  return data
}

export const sendRsvp = (payload) => post("rsvp", payload)
export const sendWish = (payload) => post("wishes", payload)

/** Deseos guardados. Si el backend no responde, simplemente no hay faroles. */
export async function fetchWishes() {
  try {
    const res = await fetch("/api/wishes")
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.wishes) ? data.wishes : []
  } catch {
    return []
  }
}
