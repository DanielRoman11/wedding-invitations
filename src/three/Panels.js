import * as THREE from "three"
import { palette } from "../config.js"
import { makeCanvas, toTexture, paintPaper, fitFont, css } from "./textures.js"

/**
 * Los paneles que viven dentro de los anillos: papel marfil con una foto
 * (complemento) y el texto (lo importante). Se pintan en canvas 768 x 1024.
 */
export const PANEL_W = 768
export const PANEL_H = 1024

const GOLD = css(palette.gold)
const INK = css(palette.espresso)
const SOFT = "rgba(107,74,54,0.95)"
/** Acento caramelo oscuro para fechas, horas y referencias: contrasta con el papel marfil */
const TEAL = "#8f5a2e"

function frame(ctx) {
  paintPaper(ctx, PANEL_W, PANEL_H, "#fffaf0")
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 3
  ctx.strokeRect(30, 30, PANEL_W - 60, PANEL_H - 60)
  ctx.lineWidth = 1
  ctx.strokeRect(44, 44, PANEL_W - 88, PANEL_H - 88)
  ctx.textAlign = "center"
}

/** Dibuja `img` cubriendo el rectángulo; `focusY` 0 = arriba, 1 = abajo (caras suelen estar arriba) */
function drawCover(ctx, img, x, y, w, h, focusY = 0.3) {
  const iw = img.width || img.naturalWidth
  const ih = img.height || img.naturalHeight
  const scale = Math.max(w / iw, h / ih)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) * focusY, sw, sh, x, y, w, h)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function photoWindow(ctx, img, x, y, w, h) {
  ctx.save()
  roundRect(ctx, x, y, w, h, 16)
  ctx.clip()
  drawCover(ctx, img, x, y, w, h)
  ctx.restore()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 3
  roundRect(ctx, x, y, w, h, 16)
  ctx.stroke()
  ctx.strokeStyle = "rgba(62,43,32,0.35)"
  ctx.lineWidth = 1
  roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 20)
  ctx.stroke()
}

/** Parte `text` en líneas que quepan en `maxWidth` con la fuente actual */
function wrap(ctx, text, maxWidth) {
  const lines = []
  let line = ""
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function paragraph(ctx, text, y, { maxWidth, lineHeight, maxLines = 99 }) {
  const lines = wrap(ctx, text, maxWidth).slice(0, maxLines)
  lines.forEach((line, i) => ctx.fillText(line, PANEL_W / 2, y + i * lineHeight))
  return y + lines.length * lineHeight
}

function marker(ctx, label) {
  ctx.font = `28px "Marcellus", serif`
  ctx.fillStyle = TEAL
  ctx.fillText(label, PANEL_W / 2, 962)
}

const pad = (n) => String(n).padStart(2, "0")

/** Historia: foto arriba, fecha, título y texto debajo */
export function storyPanel(img, step, index, total) {
  const { canvas, ctx } = makeCanvas(PANEL_W, PANEL_H)
  frame(ctx)
  photoWindow(ctx, img, 70, 74, PANEL_W - 140, 520)

  ctx.fillStyle = TEAL
  ctx.font = `28px "Mulish", sans-serif`
  ctx.fillText(step.date.toUpperCase(), PANEL_W / 2, 660)

  ctx.fillStyle = INK
  ctx.font = `${fitFont(ctx, step.title, PANEL_W - 150, 64, '"Marcellus", serif')}px "Marcellus", serif`
  ctx.fillText(step.title, PANEL_W / 2, 735)

  ctx.fillStyle = SOFT
  ctx.font = `32px "Mulish", sans-serif`
  paragraph(ctx, step.text, 800, { maxWidth: PANEL_W - 170, lineHeight: 44, maxLines: 4 })

  marker(ctx, `${pad(index + 1)} / ${pad(total)}`)
  return toTexture(canvas)
}

/** Versículo completo: foto redonda, referencia en caligrafía y los versículos centrados */
export function versePanel(img, verse) {
  const { canvas, ctx } = makeCanvas(PANEL_W, PANEL_H)
  frame(ctx)

  const cx = PANEL_W / 2
  const cy = 170
  const r = 86
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  drawCover(ctx, img, cx - r, cy - r, r * 2, r * 2, 0.25)
  ctx.restore()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = TEAL
  ctx.font = `68px "Pinyon Script", cursive`
  ctx.fillText(verse.reference, cx, 340)

  ctx.fillStyle = INK
  ctx.font = `italic 33px "Marcellus", serif`
  let y = 410
  verse.parts.forEach((text, i) => {
    y = paragraph(ctx, i === 0 ? `“${text}` : `${text}”`, y, {
      maxWidth: PANEL_W - 170,
      lineHeight: 45,
    })
    y += 18
  })

  ctx.fillStyle = css(palette.mocha)
  ctx.font = `26px "Mulish", sans-serif`
  ctx.fillText(verse.version, cx, 962)
  return toTexture(canvas)
}

/** Itinerario: foto, hora grande, momento y nota */
export function schedulePanel(img, row, index, total) {
  const { canvas, ctx } = makeCanvas(PANEL_W, PANEL_H)
  frame(ctx)
  photoWindow(ctx, img, 70, 74, PANEL_W - 140, 440)

  ctx.fillStyle = TEAL
  ctx.font = `${fitFont(ctx, row.time, PANEL_W - 160, 96, '"Marcellus", serif')}px "Marcellus", serif`
  ctx.fillText(row.time, PANEL_W / 2, 650)

  ctx.fillStyle = INK
  ctx.font = `${fitFont(ctx, row.title, PANEL_W - 150, 62, '"Marcellus", serif')}px "Marcellus", serif`
  ctx.fillText(row.title, PANEL_W / 2, 735)

  if (row.note) {
    ctx.fillStyle = SOFT
    ctx.font = `italic 32px "Mulish", sans-serif`
    paragraph(ctx, row.note, 800, { maxWidth: PANEL_W - 190, lineHeight: 44, maxLines: 3 })
  }
  marker(ctx, `${pad(index + 1)} / ${pad(total)}`)
  return toTexture(canvas)
}

/** Polaroid con foto cuadrada, para colgar del ramo */
export function polaroidTexture(img) {
  const w = 512
  const h = 600
  const { canvas, ctx } = makeCanvas(w, h)
  ctx.fillStyle = "#fffaf0"
  ctx.fillRect(0, 0, w, h)
  drawCover(ctx, img, 36, 36, w - 72, w - 72, 0.3)
  ctx.strokeStyle = "rgba(107,74,54,0.3)"
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, w - 2, h - 2)
  return toTexture(canvas)
}

/**
 * Textura de la cara exterior de un anillo: bronce caramelo con una leyenda grabada.
 * Proporción 11.6:1, la misma que la banda (2 pi R de largo por BAND_H de alto),
 * para que las letras no salgan estiradas.
 */
export function bandTexture(label) {
  const w = 3072
  const h = 264
  const { canvas, ctx } = makeCanvas(w, h)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, "#a8723f")
  g.addColorStop(0.42, "#e0b78a")
  g.addColorStop(0.62, "#c99660")
  g.addColorStop(1, "#8f5c32")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // Filetes
  ctx.strokeStyle = "rgba(62,43,32,0.5)"
  ctx.lineWidth = 3
  ctx.strokeRect(-4, 24, w + 8, h - 48)

  // La leyenda se repite 3 veces alrededor del anillo, sin tocar la costura
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const text = `\u2726  ${label.toUpperCase()}  \u2726`
  const px = fitFont(ctx, text, (w / 3) * 0.86, 84, '"Marcellus", serif')
  ctx.font = `${px}px "Marcellus", serif`
  ctx.fillStyle = "rgba(62,43,32,0.9)"
  ctx.shadowColor = "rgba(255,236,210,0.55)"
  ctx.shadowOffsetY = 2
  for (let i = 0; i < 3; i++) ctx.fillText(text, (w / 3) * (i + 0.5), h / 2 + 4)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Cara interior: oro liso con un grabado sutil de rombos (4 repeticiones, mosaico 2.9:1) */
export function innerBandTexture() {
  const w = 1024
  const h = 352
  const { canvas, ctx } = makeCanvas(w, h)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, "#b07a47")
  g.addColorStop(0.45, "#e6c496")
  g.addColorStop(1, "#9a6638")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = "rgba(62,43,32,0.28)"
  ctx.lineWidth = 2
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, h / 2 - 32)
    ctx.lineTo(x + 32, h / 2)
    ctx.lineTo(x, h / 2 + 32)
    ctx.lineTo(x - 32, h / 2)
    ctx.closePath()
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(4, 1)
  tex.anisotropy = 8
  return tex
}
