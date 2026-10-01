import { fallbackGuest } from "./config.js"

/**
 * Lee y normaliza el nombre del invitado desde la URL.
 *
 *   ?name=Pepe%20Perez   -> "Pepe Perez"
 *   ?name=pepe+perez     -> "Pepe Perez"
 *   ?name=MARIA          -> "Maria"
 *   (sin parámetro)      -> fallbackGuest ("Querido invitado")
 *
 * Devuelve { name, isFallback } para poder matizar el texto
 * ("Para Pepe" vs "Para nuestro querido invitado").
 */
export function getGuest() {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get("name")

  if (!raw) {
    return { name: fallbackGuest, isFallback: true }
  }

  // Limpieza: espacios colapsados, sin caracteres de control,
  // largo máximo razonable para que quepa en el sobre.
  const cleaned = raw
    // Solo letras (cualquier alfabeto), números, espacios, guiones y apóstrofes
    .replace(/[^\p{L}\p{N}\s'\-.]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)

  if (!cleaned) {
    return { name: fallbackGuest, isFallback: true }
  }

  // Capitaliza palabra por palabra conservando tildes y ñ.
  // "pepe perez" -> "Pepe Perez"; "McCLAIR" -> "Mcclair" (aceptable).
  const pretty = cleaned
    .split(" ")
    .map((word) =>
      word.length > 0
        ? word.charAt(0).toLocaleUpperCase("es") +
          word.slice(1).toLocaleLowerCase("es")
        : word,
    )
    .join(" ")

  return { name: pretty, isFallback: false }
}
