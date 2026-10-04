/**
 * Cliente mínimo de Google Sheets para Cloudflare Workers.
 * Firma el JWT de la cuenta de servicio con Web Crypto (sin dependencias).
 *
 * Variables de entorno (NUNCA en el código del sitio):
 *   GOOGLE_SERVICE_ACCOUNT_KEY  JSON de la cuenta de servicio, en base64 o crudo (secreto)
 *   GOOGLE_SHEET_ID             ID de la hoja de cálculo
 */

const SCOPE = "https://www.googleapis.com/auth/spreadsheets"
const encoder = new TextEncoder()

let cachedToken = { value: "", expiresAt: 0 }

const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const jsonBase64Url = (obj) => toBase64Url(encoder.encode(JSON.stringify(obj)))

function readServiceAccount(env) {
  const raw = (env.GOOGLE_SERVICE_ACCOUNT_KEY || "").trim()
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_KEY")
  return JSON.parse(raw.startsWith("{") ? raw : atob(raw))
}

async function importPrivateKey(pem) {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
}

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken.value && cachedToken.expiresAt - 60 > now) return cachedToken.value

  const account = readServiceAccount(env)
  const header = jsonBase64Url({ alg: "RS256", typ: "JWT" })
  const claim = jsonBase64Url({
    iss: account.client_email,
    scope: SCOPE,
    aud: account.token_uri,
    iat: now,
    exp: now + 3600,
  })
  const key = await importPrivateKey(account.private_key)
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(`${header}.${claim}`),
  )

  const res = await fetch(account.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${toBase64Url(signature)}`,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error("No se pudo obtener el token de Google")

  cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in || 3600) }
  return cachedToken.value
}

async function sheetsFetch(env, path, init = {}) {
  const token = await getAccessToken(env)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}${path}`,
    {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    },
  )
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(`Sheets ${res.status}: ${detail.error?.message ?? "error"}`)
  }
  return res.json()
}

/** Agrega una fila al final de la pestaña indicada */
export function appendRow(env, tab, row) {
  const range = encodeURIComponent(`${tab}!A:Z`)
  return sheetsFetch(
    env,
    `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [row] }) },
  )
}

/** Lee un rango (matriz de filas de texto) */
export async function readRange(env, range) {
  const data = await sheetsFetch(env, `/values/${encodeURIComponent(range)}`)
  return data.values ?? []
}
