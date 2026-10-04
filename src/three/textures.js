import * as THREE from "three"
import { wedding, palette } from "../config.js"

/**
 * Todas las "impresiones" del sobre, la tarjeta y las fotos de muestra
 * se dibujan en canvas 2D y se suben como texturas. Así el nombre del
 * invitado queda renderizado DENTRO de la escena 3D, sin assets externos.
 */

export const css = (hex) => `#${hex.toString(16).padStart(6, "0")}`

export function makeCanvas(w, h) {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  return { canvas, ctx: canvas.getContext("2d") }
}

export function toTexture(canvas, { repeat = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
  }
  return texture
}

/** Papel con grano sutil y viñeta (base compartida) */
export function paintPaper(ctx, w, h, base = css(palette.paper)) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  // Viñeta suave de envejecido en bordes
  const gradient = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.25,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.75,
  )
  gradient.addColorStop(0, "rgba(0,0,0,0)")
  gradient.addColorStop(1, "rgba(107,74,54,0.14)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  // Grano de papel: puntitos dispersos de baja opacidad
  ctx.save()
  for (let i = 0; i < (w * h) / 900; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    ctx.fillStyle =
      Math.random() > 0.5 ? "rgba(107,74,54,0.05)" : "rgba(255,255,255,0.06)"
    ctx.fillRect(x, y, 1.2, 1.2)
  }
  ctx.restore()
}

export function fitFont(ctx, text, maxWidth, startPx, family, weight = "") {
  let px = startPx
  do {
    ctx.font = `${weight} ${px}px ${family}`.trim()
    px -= 2
  } while (ctx.measureText(text).width > maxWidth && px > 12)
  return px
}

/* ----------------------------------------------------------------
   Frente del sobre: bordes de solapas, "Para: Nombre", filo dorado
   ---------------------------------------------------------------- */
export function createEnvelopeFrontTexture(guestName) {
  const w = 1024
  const h = 704
  const { canvas, ctx } = makeCanvas(w, h)

  paintPaper(ctx, w, h)

  const gold = css(palette.gold)
  const inkSoft = "rgba(107,74,54,0.85)"

  // Líneas de las solapas laterales y de fondo (estilo sobre clásico)
  ctx.strokeStyle = "rgba(185,133,88,0.5)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(w / 2, h * 0.62)
  ctx.lineTo(w, 0)
  ctx.moveTo(0, h)
  ctx.lineTo(w / 2, h * 0.62)
  ctx.lineTo(w, h)
  ctx.stroke()

  // Filete caramelo interior
  ctx.strokeStyle = gold
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 2
  ctx.strokeRect(28, 28, w - 56, h - 56)
  ctx.globalAlpha = 1

  // La solapa tapa el ~65% superior del frente: el nombre va en el
  // tercio inferior, donde queda visible bajo la punta del sello.
  ctx.textAlign = "center"

  // "Para"
  ctx.fillStyle = inkSoft
  ctx.font = `italic 40px Mulish, sans-serif`
  ctx.fillText("Para", w / 2, h * 0.75)

  // Nombre del invitado, caligráfico y protagonista
  const family = `"Pinyon Script", cursive`
  const px = fitFont(ctx, guestName, w * 0.72, 96, family)
  ctx.font = `${px}px ${family}`
  ctx.fillStyle = css(palette.espresso)
  ctx.fillText(guestName, w / 2, h * 0.86)

  // Subrayado caligráfico
  const nameWidth = Math.min(ctx.measureText(guestName).width * 0.8, w * 0.66)
  ctx.strokeStyle = "rgba(185,133,88,0.8)"
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(w / 2 - nameWidth / 2, h * 0.9)
  ctx.quadraticCurveTo(w / 2, h * 0.93, w / 2 + nameWidth / 2, h * 0.9)
  ctx.stroke()

  return toTexture(canvas)
}

/* ----------------------------------------------------------------
   Solapa del sobre: papel con filete dorado en V
   ---------------------------------------------------------------- */
export function createFlapTexture() {
  const w = 1024
  const h = 512
  const { canvas, ctx } = makeCanvas(w, h)

  paintPaper(ctx, w, h)

  // Filete dorado que sigue la forma de la solapa
  ctx.strokeStyle = css(palette.gold)
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(40, 34)
  ctx.quadraticCurveTo(w * 0.28, h * 0.72, w / 2, h * 0.8)
  ctx.quadraticCurveTo(w * 0.72, h * 0.72, w - 40, 34)
  ctx.stroke()
  ctx.globalAlpha = 1

  return toTexture(canvas)
}

/* ----------------------------------------------------------------
   Normaliza UVs de una geometría a su bounding box (0..1)
   ---------------------------------------------------------------- */
export function normalizeUVs(geometry) {
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox
  const sizeX = max.x - min.x || 1
  const sizeY = max.y - min.y || 1
  const uv = geometry.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) - min.x) / sizeX, (uv.getY(i) - min.y) / sizeY)
  }
  uv.needsUpdate = true
}

/* ----------------------------------------------------------------
   Sello de cera con el monograma de los novios
   ---------------------------------------------------------------- */
const MONOGRAM_TURN = -Math.PI / 2

export function createWaxSealTexture() {
  const size = 256
  const { canvas, ctx } = makeCanvas(size, size)
  const c = size / 2

  // Base de cera con borde irregular simulado con capas radiales
  const wax = ctx.createRadialGradient(c - 30, c - 40, 20, c, c, c)
  wax.addColorStop(0, "#b4674f")
  wax.addColorStop(0.55, css(palette.seal))
  wax.addColorStop(1, "#4a2217")
  ctx.fillStyle = wax
  ctx.beginPath()
  ctx.arc(c, c, c - 4, 0, Math.PI * 2)
  ctx.fill()

  // Bordes "goteados" característicos de la cera
  ctx.fillStyle = "#5c2a1d"
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.2
    const r = c - 14
    const x = c + Math.cos(angle) * r
    const y = c + Math.sin(angle) * r
    ctx.beginPath()
    ctx.arc(x, y, 8 + Math.random() * 10, 0, Math.PI * 2)
    ctx.fill()
  }
  // Re-encima la parte central para que las gotas asomen por el borde
  ctx.fillStyle = wax
  ctx.beginPath()
  ctx.arc(c, c, c - 20, 0, Math.PI * 2)
  ctx.fill()

  // Aro grabado
  ctx.strokeStyle = "rgba(255,224,200,0.4)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(c, c, c - 42, 0, Math.PI * 2)
  ctx.stroke()

  // Monograma en relieve. La tapa del cilindro del sello queda girada 90° en la
  // solapa, así que se dibuja girado para que se lea en horizontal.
  ctx.save()
  ctx.translate(c, c)
  ctx.rotate(MONOGRAM_TURN)
  ctx.translate(-c, -c)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `64px "Marcellus", serif`
  ctx.fillStyle = "rgba(40,14,8,0.55)"
  ctx.fillText(wedding.monogram, c + 3, c + 4)
  ctx.fillStyle = css(palette.ivory)
  ctx.fillText(wedding.monogram, c, c)
  ctx.restore()

  // Brillo superior
  const shine = ctx.createRadialGradient(c - 40, c - 55, 4, c - 40, c - 55, 60)
  shine.addColorStop(0, "rgba(255,235,225,0.5)")
  shine.addColorStop(1, "rgba(255,235,225,0)")
  ctx.fillStyle = shine
  ctx.beginPath()
  ctx.arc(c - 40, c - 55, 60, 0, Math.PI * 2)
  ctx.fill()

  return toTexture(canvas)
}

/* ----------------------------------------------------------------
   Tarjeta de invitación (lo que sale del sobre)
   Frente: nombres + fecha.   Dorso: monograma.
   ---------------------------------------------------------------- */
export function createCardFrontTexture(guestName) {
  const w = 768
  const h = 1024
  const { canvas, ctx } = makeCanvas(w, h)

  paintPaper(ctx, w, h, "#fffaf0")

  const gold = css(palette.gold)

  // Doble filete dorado
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.strokeRect(30, 30, w - 60, h - 60)
  ctx.lineWidth = 1
  ctx.strokeRect(44, 44, w - 88, h - 88)

  ctx.textAlign = "center"

  // Monograma superior
  ctx.font = `46px "Marcellus", serif`
  ctx.fillStyle = gold
  ctx.fillText(wedding.monogram, w / 2, 122)

  // Título: deja claro que ESTA es la tarjeta de invitación
  const label = "INVITACIÓN DE BODA"
  ctx.font = `30px "Marcellus", serif`
  ctx.fillStyle = css(palette.mocha)
  if ("letterSpacing" in ctx) ctx.letterSpacing = "7px"
  ctx.fillText(label, w / 2 + 3, 188)
  const half = ctx.measureText(label).width / 2
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"
  ctx.strokeStyle = gold
  ctx.lineWidth = 1.5
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(w / 2 + side * (half + 22), 178)
    ctx.lineTo(w / 2 + side * (half + 82), 178)
    ctx.stroke()
  }

  // "Para" + invitado
  ctx.font = "italic 30px Mulish, sans-serif"
  ctx.fillStyle = "rgba(107,74,54,0.9)"
  ctx.fillText("Para", w / 2, 258)
  ctx.font = `${fitFont(ctx, guestName, w * 0.7, 74, '"Pinyon Script", cursive')}px "Pinyon Script", cursive`
  ctx.fillStyle = css(palette.espresso)
  ctx.fillText(guestName, w / 2, 332)

  ctx.font = "italic 30px Mulish, sans-serif"
  ctx.fillStyle = "rgba(107,74,54,0.9)"
  ctx.fillText("te invitan a celebrar su boda", w / 2, 402)

  // Nombres de los novios
  ctx.font = `64px "Marcellus", serif`
  ctx.fillStyle = css(palette.espresso)
  ctx.fillText(wedding.groom, w / 2, 492)
  ctx.font = `52px "Pinyon Script", cursive`
  ctx.fillStyle = css(palette.caramel)
  ctx.fillText("&", w / 2, 553)
  ctx.font = `64px "Marcellus", serif`
  ctx.fillStyle = css(palette.espresso)
  ctx.fillText(wedding.bride, w / 2, 626)

  // Motivo: dos anillos entrelazados
  drawRings(ctx, w / 2, 735, 50, css(palette.gold))

  // Fecha
  ctx.font = `40px "Marcellus", serif`
  ctx.fillStyle = css(palette.espresso)
  ctx.fillText(wedding.dateLabel, w / 2, 860)
  ctx.font = `30px "Marcellus", serif`
  ctx.fillStyle = "rgba(107,74,54,0.95)"
  ctx.fillText(wedding.timeLabel, w / 2, 905)

  return toTexture(canvas)
}

/**
 * Reverso de la tarjeta: solo papel y doble filete.
 * El texto (lugar, botones, notas) es HTML encima, para que sea interactivo.
 */
export function createCardBackTexture() {
  const w = 768
  const h = 1024
  const { canvas, ctx } = makeCanvas(w, h)
  const gold = css(palette.gold)

  paintPaper(ctx, w, h, "#f9f0e1")

  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.strokeRect(30, 30, w - 60, h - 60)
  ctx.lineWidth = 1
  ctx.strokeRect(44, 44, w - 88, h - 88)

  return toTexture(canvas)
}

/**
 * Papel de deseos. `closed` trae la leyenda para que invite a tocarlo;
 * `open` es solo papel rayado: el formulario HTML se dibuja encima.
 */
export function createWishPaperTexture(closed) {
  const w = 600
  const h = 760
  const { canvas, ctx } = makeCanvas(w, h)
  paintPaper(ctx, w, h, "#fcf0e6")

  // Renglones de libreta
  ctx.strokeStyle = "rgba(185,133,88,0.34)"
  ctx.lineWidth = 1.5
  for (let y = 150; y < h - 40; y += 46) {
    ctx.beginPath()
    ctx.moveTo(44, y)
    ctx.lineTo(w - 44, y)
    ctx.stroke()
  }
  // Margen rosado
  ctx.strokeStyle = "rgba(205,120,105,0.38)"
  ctx.beginPath()
  ctx.moveTo(86, 30)
  ctx.lineTo(86, h - 30)
  ctx.stroke()

  if (closed) {
    ctx.textAlign = "center"
    ctx.fillStyle = css(palette.mocha)
    ctx.font = `64px "Pinyon Script", cursive`
    ctx.fillText("Manda un", w / 2 + 20, 250)
    ctx.fillText("mensaje en el arco", w / 2 + 20, 330)
    // Estrella
    ctx.fillStyle = css(palette.gold)
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 22 : 56
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      ctx.lineTo(w / 2 + 20 + Math.cos(a) * r, 520 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  }
  return toTexture(canvas)
}

function drawRings(ctx, cx, cy, r, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(3, r * 0.08)
  ctx.beginPath()
  ctx.arc(cx - r * 0.55, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  // Diamante del segundo anillo
  ctx.beginPath()
  ctx.arc(cx + r * 0.55, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  const dx = cx + r * 0.55
  const dy = cy - r
  ctx.fillStyle = css(palette.ivory)
  ctx.beginPath()
  ctx.moveTo(dx, dy - r * 0.34)
  ctx.lineTo(dx + r * 0.2, dy - r * 0.08)
  ctx.lineTo(dx, dy + r * 0.18)
  ctx.lineTo(dx - r * 0.2, dy - r * 0.08)
  ctx.closePath()
  ctx.fill()
}

/* ----------------------------------------------------------------
   Foto de muestra para el anillo (hasta que subas las tuyas)
   ---------------------------------------------------------------- */
export function createPhotoPlaceholderTexture(index, total) {
  const w = 512
  const h = 640
  const { canvas, ctx } = makeCanvas(w, h)

  // Marco tipo polaroid
  ctx.fillStyle = "#fffaf0"
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = "rgba(107,74,54,0.3)"
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, w - 2, h - 2)

  // "Fotografía": campo de día con sol y colinas, tonos de la paleta
  const ix = 34
  const iy = 34
  const iw = w - 68
  const ih = h - 170

  const sky = ctx.createLinearGradient(0, iy, 0, iy + ih)
  sky.addColorStop(0, "#f2cfb4")
  sky.addColorStop(0.6, "#f8e4cc")
  sky.addColorStop(1, "#fbf1e0")
  ctx.fillStyle = sky
  ctx.fillRect(ix, iy, iw, ih)

  // Nubes suaves
  let seed = index * 7919 + 13
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  ctx.fillStyle = "rgba(255,255,255,0.45)"
  for (let i = 0; i < 6; i++) {
    const cx = ix + rand() * iw
    const cy = iy + ih * (0.12 + rand() * 0.42)
    const r = 22 + rand() * 40
    ctx.beginPath()
    ctx.ellipse(cx, cy, r * 1.7, r * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Sol con halo cálido (posición varía por foto)
  const sunX = ix + iw * (0.25 + 0.5 * ((index % total) / Math.max(1, total - 1)))
  const sunY = iy + ih * 0.22
  const halo = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 70)
  halo.addColorStop(0, "rgba(255,232,178,0.7)")
  halo.addColorStop(1, "rgba(255,232,178,0)")
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(sunX, sunY, 70, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#ffeec2"
  ctx.beginPath()
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2)
  ctx.fill()

  // Colinas salvia de la paleta
  ctx.fillStyle = css(palette.sage)
  ctx.beginPath()
  ctx.moveTo(ix, iy + ih)
  ctx.bezierCurveTo(
    ix + iw * 0.25,
    iy + ih * 0.55,
    ix + iw * 0.4,
    iy + ih * 0.8,
    ix + iw * 0.62,
    iy + ih * 0.68,
  )
  ctx.bezierCurveTo(ix + iw * 0.85, iy + ih * 0.55, ix + iw * 0.9, iy + ih * 0.85, ix + iw, iy + ih * 0.75)
  ctx.lineTo(ix + iw, iy + ih)
  ctx.closePath()
  ctx.fill()

  // Silueta de pareja (dos figuras sencillas bajo el sol)
  const px = ix + iw / 2
  const py = iy + ih * 0.92
  ctx.fillStyle = css(palette.mocha)
  // figura alta (traje)
  ctx.beginPath()
  ctx.arc(px - 16, py - 58, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(px - 27, py - 48, 22, 48)
  // figura con vestido
  ctx.beginPath()
  ctx.arc(px + 12, py - 52, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(px + 3, py - 42)
  ctx.lineTo(px + 21, py - 42)
  ctx.lineTo(px + 30, py)
  ctx.lineTo(px - 6, py)
  ctx.closePath()
  ctx.fill()

  // Pie caligráfico
  ctx.textAlign = "center"
  ctx.font = `italic 30px "Pinyon Script", cursive`
  ctx.fillStyle = css(palette.espresso)
  ctx.fillText(
    `${wedding.groom} & ${wedding.bride}`,
    w / 2,
    h - 92,
  )
  ctx.font = "22px Mulish, sans-serif"
  ctx.fillStyle = "rgba(107,74,54,0.8)"
  ctx.fillText(`Foto ${String(index + 1).padStart(2, "0")}`, w / 2, h - 52)

  return toTexture(canvas)
}
