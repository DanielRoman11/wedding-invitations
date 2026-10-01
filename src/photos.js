import { photos, placeholderPhotoCount } from "./config.js"
import { createPhotoPlaceholderTexture } from "./three/textures.js"

/**
 * Descarga las fotos de config.photos como imágenes. Una que falte se
 * descarta; si no queda ninguna, se usan tarjetas de muestra dibujadas.
 */
export async function loadPhotoImages() {
  const load = (url) =>
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })

  if (photos.length > 0) {
    const loaded = (
      await Promise.all(photos.map((url) => load(`${import.meta.env.BASE_URL}${url}`)))
    ).filter(Boolean)
    if (loaded.length > 0) return loaded
  }
  return Array.from(
    { length: placeholderPhotoCount },
    (_, i) => createPhotoPlaceholderTexture(i, placeholderPhotoCount).image,
  )
}

/** Foto número i, reutilizándolas en orden si hay pocas */
export const photoAt = (images, i) => images[((i % images.length) + images.length) % images.length]
